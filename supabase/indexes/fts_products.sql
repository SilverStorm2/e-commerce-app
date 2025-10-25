-- Product full-text search indexes (mirrors migration 0003_search_fts.sql).
create index if not exists products_search_vector_idx
on public.products
using gin (search_vector);

create index if not exists products_name_trgm_idx
on public.products
using gin ((unaccent(name)) gin_trgm_ops);
