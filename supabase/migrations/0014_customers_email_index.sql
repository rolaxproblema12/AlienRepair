create index if not exists customers_email_trgm_idx
  on public.customers using gin (email gin_trgm_ops);
