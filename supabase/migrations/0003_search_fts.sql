-- M2-SEARCH-FTS
-- Full-text search foundations for products and contractors plus unified RPC.

begin;

-- Helper utilities ----------------------------------------------------------

create or replace function app_hidden.normalize_search_text(input_text text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(lower(unaccent(coalesce(input_text, ''))), '\s+', ' ', 'g'), '');
$$;

create or replace function app_hidden.jsonb_array_to_text(input_data jsonb)
returns text
language sql
immutable
as $$
  select nullif(
    array_to_string(
      array(
        select value
        from jsonb_array_elements_text(coalesce(input_data, '[]'::jsonb)) as value
        where value is not null and btrim(value) <> ''
      ),
      ' '
    ),
    ''
  );
$$;

create or replace function app_hidden.concat_jsonb_text(input_data jsonb)
returns text
language sql
immutable
as $$
  select nullif(
    array_to_string(
      array(
        select value
        from jsonb_each_text(coalesce(input_data, '{}'::jsonb))
        where value is not null and btrim(value) <> ''
      ),
      ' '
    ),
    ''
  );
$$;

-- Product search vector + indexes ------------------------------------------

create or replace function app_hidden.compute_product_search_vector(product_row public.products)
returns tsvector
language plpgsql
as $$
declare
  vector tsvector := ''::tsvector;
  normalized text;
begin
  normalized := app_hidden.normalize_search_text(product_row.name);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'A');
  end if;

  normalized := app_hidden.normalize_search_text(app_hidden.concat_jsonb_text(product_row.name_i18n));
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'A');
  end if;

  normalized := app_hidden.normalize_search_text(product_row.short_description);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'B');
  end if;

  normalized := app_hidden.normalize_search_text(app_hidden.concat_jsonb_text(product_row.short_description_i18n));
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'B');
  end if;

  normalized := app_hidden.normalize_search_text(product_row.description);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'C');
  end if;

  normalized := app_hidden.normalize_search_text(app_hidden.concat_jsonb_text(product_row.description_i18n));
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'C');
  end if;

  normalized := app_hidden.normalize_search_text(product_row.sku);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'D');
  end if;

  normalized := app_hidden.normalize_search_text(product_row.barcode);
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'D');
  end if;

  normalized := app_hidden.normalize_search_text(coalesce(product_row.metadata ->> 'tags', ''));
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'C');
  end if;

  return vector;
end;
$$;

create or replace function app_hidden.products_search_vector_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := app_hidden.compute_product_search_vector(new);
  return new;
end;
$$;

drop trigger if exists products_search_vector_set on public.products;

create trigger products_search_vector_set
before insert or update on public.products
for each row
execute function app_hidden.products_search_vector_trigger();

update public.products as p
set search_vector = app_hidden.compute_product_search_vector(p);

create index if not exists products_search_vector_idx
on public.products
using gin (search_vector);

create index if not exists products_name_trgm_idx
on public.products
using gin ((unaccent(name)) gin_trgm_ops);

-- Contractor search helpers ------------------------------------------------

create or replace function app_hidden.compute_contractor_search_vector(payload jsonb)
returns tsvector
language plpgsql
as $$
declare
  vector tsvector := ''::tsvector;
  normalized text;
  aggregated text;
begin
  if payload is null then
    return ''::tsvector;
  end if;

  normalized := app_hidden.normalize_search_text(payload ->> 'display_name');
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'A');
  end if;

  normalized := app_hidden.normalize_search_text(payload ->> 'headline');
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'A');
  end if;

  normalized := app_hidden.normalize_search_text(payload ->> 'title');
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'A');
  end if;

  normalized := app_hidden.normalize_search_text(payload ->> 'short_bio');
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'B');
  end if;

  normalized := app_hidden.normalize_search_text(payload ->> 'bio');
  if normalized is not null then
    vector := vector || setweight(to_tsvector('simple', normalized), 'C');
  end if;

  aggregated := app_hidden.normalize_search_text(app_hidden.jsonb_array_to_text(payload -> 'skills'));
  if aggregated is not null then
    vector := vector || setweight(to_tsvector('simple', aggregated), 'B');
  end if;

  aggregated := app_hidden.normalize_search_text(app_hidden.jsonb_array_to_text(payload -> 'service_areas'));
  if aggregated is not null then
    vector := vector || setweight(to_tsvector('simple', aggregated), 'B');
  end if;

  aggregated := app_hidden.normalize_search_text(app_hidden.jsonb_array_to_text(payload -> 'languages'));
  if aggregated is not null then
    vector := vector || setweight(to_tsvector('simple', aggregated), 'C');
  end if;

  aggregated := app_hidden.normalize_search_text(app_hidden.jsonb_array_to_text(payload -> 'tags'));
  if aggregated is not null then
    vector := vector || setweight(to_tsvector('simple', aggregated), 'B');
  end if;

  return vector;
end;
$$;

create or replace function app_hidden.contractor_profiles_search_trigger()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := app_hidden.compute_contractor_search_vector(to_jsonb(new));
  return new;
end;
$$;

create or replace function app_hidden.ensure_contractor_search_support()
returns boolean
language plpgsql
as $$
declare
  has_table boolean;
  has_display_name boolean;
  has_slug boolean;
  has_visibility boolean;
begin
  select to_regclass('public.contractor_profiles') is not null into has_table;
  if not has_table then
    return false;
  end if;

  perform 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'contractor_profiles'
    and column_name = 'search_vector';

  if not found then
    execute 'alter table public.contractor_profiles add column search_vector tsvector not null default ''::tsvector''';
  end if;

  drop trigger if exists contractor_profiles_search_vector_set on public.contractor_profiles;

  execute '
    create trigger contractor_profiles_search_vector_set
    before insert or update on public.contractor_profiles
    for each row
    execute function app_hidden.contractor_profiles_search_trigger()
  ';

  execute '
    create index if not exists contractor_profiles_search_vector_idx
    on public.contractor_profiles
    using gin (search_vector)
  ';

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contractor_profiles'
      and column_name = 'display_name'
  ) into has_display_name;

  if has_display_name then
    execute '
      create index if not exists contractor_profiles_name_trgm_idx
      on public.contractor_profiles
      using gin ((unaccent(display_name)) gin_trgm_ops)
    ';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contractor_profiles'
      and column_name = 'slug'
  ) into has_slug;

  if has_slug then
    execute '
      create index if not exists contractor_profiles_slug_trgm_idx
      on public.contractor_profiles
      using gin ((unaccent(slug)) gin_trgm_ops)
    ';
  end if;

  execute $sql$
    update public.contractor_profiles as cp
    set search_vector = app_hidden.compute_contractor_search_vector(to_jsonb(cp))
  $sql$;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contractor_profiles'
      and column_name = 'is_visible'
  ) into has_visibility;

  if not has_visibility then
    execute '
      alter table public.contractor_profiles
      add column if not exists is_visible boolean default true
    ';
  end if;

  return true;
end;
$$;

-- Run once (no-op until contractor_profiles exists).
select app_hidden.ensure_contractor_search_support();

-- Unified search RPC -------------------------------------------------------

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
        coalesce(cp.slug, to_jsonb(cp)->>''slug'') as slug,
        coalesce(
          nullif(to_jsonb(cp)->>''display_name'', ''''),
          nullif(to_jsonb(cp)->>''headline'', ''''),
          nullif(to_jsonb(cp)->>''title'', '''')
        ) as title,
        coalesce(
          nullif(to_jsonb(cp)->>''headline'', ''''),
          nullif(to_jsonb(cp)->>''short_bio'', '''')
        ) as subtitle,
        null::text as snippet,
        (
          ts_rank_cd(cp.search_vector, $1) * 1.4
          + greatest(
              similarity(unaccent(coalesce(to_jsonb(cp)->>''display_name'', '''')), $3),
              similarity(unaccent(coalesce(to_jsonb(cp)->>''headline'', '''')), $3)
            )
        ) as rank,
        jsonb_build_object(
          ''type'', ''contractor'',
          ''user_id'', to_jsonb(cp)->>''user_id'',
          ''skills'', to_jsonb(cp)->''skills'',
          ''service_areas'', to_jsonb(cp)->''service_areas''
        ) as payload
      from public.contractor_profiles cp
      where
        coalesce((to_jsonb(cp)->>''is_visible'')::boolean, true)
        and cp.search_vector is not null
        and (
          (cp.search_vector @@ $1)
          or similarity(unaccent(coalesce(to_jsonb(cp)->>''display_name'', '''')), $3) >= 0.3
          or similarity(unaccent(coalesce(to_jsonb(cp)->>''headline'', '''')), $3) >= 0.3
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
