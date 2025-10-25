-- M2-CONTRACTOR-DIR
-- Contractor profiles directory with search vectors and RLS.

begin;

create table if not exists public.contractor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  display_name text not null,
  headline text,
  short_bio text,
  bio text,
  avatar_url text,
  availability text,
  hourly_rate numeric(10, 2) check (hourly_rate is null or hourly_rate >= 0),
  currency_code text not null default 'PLN' check (currency_code = 'PLN'),
  skills text[] not null default array[]::text[],
  service_areas text[] not null default array[]::text[],
  languages text[] not null default array[]::text[],
  portfolio_urls jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  preferred_collaboration text,
  contact_email text,
  contact_phone text,
  is_visible boolean not null default false,
  featured boolean not null default false,
  search_vector tsvector not null default ''::tsvector,
  created_by uuid default auth.uid(),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contractor_profiles_user_unique unique (user_id),
  constraint contractor_profiles_slug_not_blank check (char_length(trim(slug)) > 0),
  constraint contractor_profiles_display_name_not_blank check (char_length(trim(display_name)) > 0),
  constraint contractor_profiles_contact_email_lowercase check (
    contact_email is null or contact_email = lower(contact_email)
  ),
  constraint contractor_profiles_contact_phone_not_blank check (
    contact_phone is null or char_length(trim(contact_phone)) > 0
  )
);

comment on table public.contractor_profiles is
  'Marketplace contractor directory profiles exposed to guests when visible.';

create unique index if not exists contractor_profiles_slug_unique
  on public.contractor_profiles (lower(slug));

create index if not exists contractor_profiles_visible_idx
  on public.contractor_profiles (is_visible)
  where is_visible;

create index if not exists contractor_profiles_featured_idx
  on public.contractor_profiles (featured)
  where featured;

create index if not exists contractor_profiles_skills_idx
  on public.contractor_profiles
  using gin (skills);

create index if not exists contractor_profiles_service_areas_idx
  on public.contractor_profiles
  using gin (service_areas);

create index if not exists contractor_profiles_languages_idx
  on public.contractor_profiles
  using gin (languages);

create index if not exists contractor_profiles_search_vector_idx
  on public.contractor_profiles
  using gin (search_vector);

comment on column public.contractor_profiles.search_vector is
  'Precomputed TSVECTOR used by search_entities RPC and text search filters.';

create or replace function app_hidden.compute_contractor_search_vector(profile_row public.contractor_profiles)
returns tsvector
language plpgsql
as $$
declare
  vector tsvector := ''::tsvector;
  normalized text;
begin
  normalized := app_hidden.normalize_search_text(profile_row.display_name);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'A');
  end if;

  normalized := app_hidden.normalize_search_text(profile_row.headline);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'A');
  end if;

  normalized := app_hidden.normalize_search_text(profile_row.short_bio);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'B');
  end if;

  normalized := app_hidden.normalize_search_text(profile_row.bio);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'C');
  end if;

  normalized := app_hidden.normalize_search_text(array_to_string(profile_row.skills, ' '));
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'B');
  end if;

  normalized := app_hidden.normalize_search_text(array_to_string(profile_row.service_areas, ' '));
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'B');
  end if;

  normalized := app_hidden.normalize_search_text(array_to_string(profile_row.languages, ' '));
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'C');
  end if;

  return vector;
end;
$$;

create or replace function app_hidden.contractor_profiles_search_vector_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := app_hidden.compute_contractor_search_vector(new);
  return new;
end;
$$;

drop trigger if exists contractor_profiles_search_vector_set on public.contractor_profiles;

create trigger contractor_profiles_search_vector_set
before insert or update on public.contractor_profiles
for each row
execute function app_hidden.contractor_profiles_search_vector_trigger();

update public.contractor_profiles as cp
set search_vector = app_hidden.compute_contractor_search_vector(cp);

alter table public.contractor_profiles enable row level security;

create policy contractor_profiles_public_select on public.contractor_profiles
for select
using (is_visible = true);

create policy contractor_profiles_self_select on public.contractor_profiles
for select
using (
  app_hidden.is_platform_admin()
  or auth.uid() = user_id
);

create policy contractor_profiles_self_insert on public.contractor_profiles
for insert
with check (
  app_hidden.is_platform_admin()
  or auth.uid() = user_id
);

create policy contractor_profiles_self_update on public.contractor_profiles
for update
using (
  app_hidden.is_platform_admin()
  or auth.uid() = user_id
)
with check (
  app_hidden.is_platform_admin()
  or auth.uid() = user_id
);

create policy contractor_profiles_self_delete on public.contractor_profiles
for delete
using (
  app_hidden.is_platform_admin()
  or auth.uid() = user_id
);

create or replace function public.search_entities(
  search_term text,
  locale text default 'pl',
  include_products boolean default true,
  include_contractors boolean default true,
  limit_count integer default 20
)
returns table (
  entity_type text,
  entity_id uuid,
  tenant_id uuid,
  slug text,
  title text,
  subtitle text,
  snippet text,
  rank numeric,
  payload jsonb
)
language plpgsql
security definer
set search_path = public, app_hidden
as $$
declare
  normalized_query text;
  ts_query tsquery;
  sql text;
  has_section boolean := false;
  safe_limit integer := greatest(10, least(limit_count, 50));
  contractor_available boolean;
begin
  normalized_query := app_hidden.normalize_search_text(search_term);
  if normalized_query is null then
    return;
  end if;

  ts_query := websearch_to_tsquery('simple', normalized_query);
  contractor_available := include_contractors and to_regclass('public.contractor_profiles') is not null;

  sql := 'select entity_type, entity_id, tenant_id, slug, title, subtitle, snippet, rank, payload from (';

  if include_products then
    sql := sql || '
      select
        ''product''::text as entity_type,
        p.id as entity_id,
        p.tenant_id,
        p.slug,
        coalesce(nullif(p.name_i18n ->> $4, ''''), p.name) as title,
        nullif(coalesce(p.short_description_i18n ->> $4, p.short_description), '''') as subtitle,
        null::text as snippet,
        (
          ts_rank_cd(p.search_vector, $1) * 1.5
          + greatest(
              similarity(unaccent(p.name), $3),
              similarity(unaccent(coalesce(p.name_i18n ->> $4, '''')), $3)
            )
        ) as rank,
        jsonb_build_object(
          ''type'', ''product'',
          ''price_amount'', p.price_amount,
          ''currency_code'', p.currency_code,
          ''tenant_id'', p.tenant_id
        ) as payload
      from public.products p
      where
        p.is_published = true
        and p.status = ''active''
        and (p.published_at is null or p.published_at <= now())
        and (
          (p.search_vector @@ $1)
          or similarity(unaccent(p.name), $3) >= 0.35
          or similarity(unaccent(coalesce(p.name_i18n ->> $4, '''')), $3) >= 0.35
        )
    ';
    has_section := true;
  end if;

  if contractor_available then
    if has_section then
      sql := sql || ' union all ';
    end if;

    sql := sql || '
      select
        ''contractor''::text as entity_type,
        cp.id as entity_id,
        null::uuid as tenant_id,
        cp.slug,
        coalesce(
          nullif(cp.display_name, ''''),
          nullif(cp.headline, ''''),
          cp.slug
        ) as title,
        coalesce(
          nullif(cp.headline, ''''),
          nullif(cp.short_bio, '''')
        ) as subtitle,
        null::text as snippet,
        (
          ts_rank_cd(cp.search_vector, $1) * 1.4
          + greatest(
              similarity(unaccent(coalesce(cp.display_name, '''')), $3),
              similarity(unaccent(coalesce(cp.headline, '''')), $3)
            )
        ) as rank,
        jsonb_build_object(
          ''type'', ''contractor'',
          ''user_id'', cp.user_id,
          ''slug'', cp.slug,
          ''headline'', cp.headline,
          ''short_bio'', cp.short_bio,
          ''skills'', coalesce(to_jsonb(cp.skills), ''[]''::jsonb),
          ''service_areas'', coalesce(to_jsonb(cp.service_areas), ''[]''::jsonb),
          ''languages'', coalesce(to_jsonb(cp.languages), ''[]''::jsonb),
          ''availability'', cp.availability,
          ''hourly_rate'', cp.hourly_rate,
          ''currency_code'', cp.currency_code,
          ''avatar_url'', cp.avatar_url,
          ''featured'', cp.featured
        ) as payload
      from public.contractor_profiles cp
      where
        cp.is_visible = true
        and cp.search_vector is not null
        and (
          (cp.search_vector @@ $1)
          or similarity(unaccent(coalesce(cp.display_name, '''')), $3) >= 0.3
          or similarity(unaccent(coalesce(cp.headline, '''')), $3) >= 0.3
          or similarity(unaccent(array_to_string(cp.skills, '' '')), $3) >= 0.3
        )
    ';
    has_section := true;
  end if;

  sql := sql || ') as combined
    order by rank desc, title asc
    limit $2';

  if not has_section then
    return;
  end if;

  return query execute sql using ts_query, safe_limit, normalized_query, locale;
end;
$$;

grant execute on function public.search_entities(text, text, boolean, boolean, integer) to anon, authenticated;

commit;
