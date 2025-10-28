-- M3-WEBHOOKS-STRIPE
-- Payment reconciliation for Stripe checkout sessions with inventory commits.

begin;

create or replace function public.reconcile_order_group_payment(
  p_order_group_id uuid,
  p_payment_intent text,
  p_webhook_event_id text,
  p_webhook_created timestamptz,
  p_amount_total numeric,
  p_currency_code text,
  p_event_type text default null,
  p_event_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  group_row public.order_groups%rowtype;
  processed_event_id text;
  now_ts timestamptz := now();
  metadata_base jsonb;
  metadata_patch jsonb;
  orders_count integer := 0;
  inventory_committed integer := 0;
  expected_amount numeric;
  event_summary jsonb;
begin
  if p_order_group_id is null then
    raise exception 'order_group_id is required';
  end if;

  select *
    into group_row
  from public.order_groups
  where id = p_order_group_id
  for update;

  if not found then
    raise exception 'Order group % not found', p_order_group_id;
  end if;

  processed_event_id := group_row.metadata->>'stripe_webhook_event_id';

  if processed_event_id = p_webhook_event_id then
    return jsonb_build_object(
      'order_group_id', p_order_group_id,
      'applied', false,
      'reason', 'event_already_processed'
    );
  end if;

  if p_currency_code is not null and lower(p_currency_code) <> lower(group_row.currency_code) then
    raise exception 'Currency mismatch for order_group % (expected %, got %)',
      p_order_group_id,
      group_row.currency_code,
      p_currency_code;
  end if;

  if p_amount_total is not null then
    expected_amount := round(group_row.total_amount, 2);
    if round(p_amount_total, 2) <> expected_amount then
      raise exception 'Amount mismatch for order_group % (expected %, got %)',
        p_order_group_id,
        expected_amount,
        round(p_amount_total, 2);
    end if;
  end if;

  update public.orders
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now_ts),
    placed_at = coalesce(placed_at, now_ts),
    metadata = jsonb_strip_nulls(
      coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'stripe_payment_status', 'paid',
        'stripe_payment_intent', coalesce(p_payment_intent, metadata->>'stripe_payment_intent'),
        'stripe_webhook_event_id', p_webhook_event_id,
        'stripe_webhook_event_type', p_event_type
      )
    ),
    updated_at = now_ts
  where order_group_id = p_order_group_id;

  get diagnostics orders_count = row_count;

  if orders_count = 0 then
    raise exception 'Order group % has no child orders to reconcile', p_order_group_id;
  end if;

  insert into public.inventory_ledger (
    product_id,
    tenant_id,
    quantity_delta,
    event_type,
    reason,
    reference_type,
    reference_id,
    metadata,
    created_at
  )
  select
    oi.product_id,
    oi.tenant_id,
    -oi.quantity,
    'order_commit',
    'order_paid',
    'order_item',
    oi.id,
    jsonb_strip_nulls(
      jsonb_build_object(
        'order_group_id', p_order_group_id,
        'order_id', oi.order_id,
        'payment_intent', p_payment_intent,
        'webhook_event_id', p_webhook_event_id
      )
    ),
    now_ts
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.order_group_id = p_order_group_id
    and oi.product_id is not null
    and not exists (
      select 1
      from public.inventory_ledger il
      where il.reference_type = 'order_item'
        and il.reference_id = oi.id
        and il.event_type = 'order_commit'
    );

  get diagnostics inventory_committed = row_count;

  metadata_base := coalesce(group_row.metadata, '{}'::jsonb);

  metadata_patch := jsonb_build_object(
    'stripe_payment_status', 'paid',
    'stripe_payment_intent', coalesce(p_payment_intent, metadata_base->>'stripe_payment_intent'),
    'stripe_webhook_event_id', p_webhook_event_id,
    'stripe_webhook_event_type', p_event_type,
    'stripe_webhook_received_at', to_jsonb(now_ts)
  );

  if p_webhook_created is not null then
    metadata_patch := metadata_patch || jsonb_build_object('stripe_webhook_created_at', to_jsonb(p_webhook_created));
  end if;

  if p_currency_code is not null then
    metadata_patch := metadata_patch || jsonb_build_object('stripe_currency', upper(p_currency_code));
  end if;

  if p_amount_total is not null then
    metadata_patch := metadata_patch || jsonb_build_object('stripe_amount_total', round(p_amount_total, 2));
  end if;

  if p_event_metadata is not null and p_event_metadata <> '{}'::jsonb then
    metadata_patch := metadata_patch || jsonb_build_object('stripe_event_metadata', p_event_metadata);
  end if;

  event_summary := jsonb_strip_nulls(
    jsonb_build_object(
      'id', p_webhook_event_id,
      'type', p_event_type,
      'created_at', p_webhook_created,
      'received_at', now_ts,
      'amount_total', p_amount_total,
      'currency', p_currency_code,
      'payment_intent', coalesce(p_payment_intent, metadata_base->>'stripe_payment_intent')
    )
  );

  metadata_patch := metadata_patch || jsonb_build_object('stripe_last_event', event_summary);

  update public.order_groups
  set
    status = 'paid',
    paid_at = coalesce(group_row.paid_at, now_ts),
    placed_at = coalesce(group_row.placed_at, now_ts),
    metadata = jsonb_strip_nulls(metadata_base || metadata_patch),
    updated_at = now_ts
  where id = p_order_group_id;

  return jsonb_build_object(
    'order_group_id', p_order_group_id,
    'applied', true,
    'orders_updated', orders_count,
    'inventory_committed', coalesce(inventory_committed, 0)
  );
end;
$$;

grant execute on function public.reconcile_order_group_payment(
  uuid,
  text,
  text,
  timestamptz,
  numeric,
  text,
  text,
  jsonb
) to service_role;

commit;
