-- M3-SHIPPING
-- Shipping metadata: carrier method fields and tracking references on orders.

begin;

alter table public.orders
  add column if not exists shipping_method text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text;

comment on column public.orders.shipping_method is 'Carrier or method label provided by the seller.';
comment on column public.orders.tracking_number is 'Carrier-provided tracking number or identifier.';
comment on column public.orders.tracking_url is 'Link to the carrier tracking page.';

commit;
