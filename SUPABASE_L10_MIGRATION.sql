-- L10 nullable social links. Run manually in the Supabase SQL editor only
-- after reviewing the project's existing event_config schema and RPC grants.
-- This does not alter guests, short links, credentials, or existing URLs.
alter table public.event_config
  add column if not exists tiktok_url text null,
  add column if not exists maps_url text null;

-- Validation after migration (expect one row and nullable new columns):
select id, facebook_url, instagram_url, website_url, tiktok_url, maps_url
from public.event_config
where id = 1;
