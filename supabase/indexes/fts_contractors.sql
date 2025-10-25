-- Contractor full-text search indexes (applied via app_hidden.ensure_contractor_search_support()).
create index if not exists contractor_profiles_search_vector_idx
on public.contractor_profiles
using gin (search_vector);

create index if not exists contractor_profiles_name_trgm_idx
on public.contractor_profiles
using gin ((unaccent(display_name)) gin_trgm_ops);

create index if not exists contractor_profiles_slug_trgm_idx
on public.contractor_profiles
using gin ((unaccent(slug)) gin_trgm_ops);
