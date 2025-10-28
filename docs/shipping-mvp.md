# Shipping MVP Notes

## Scope

- Manual fulfilment flow for sellers after payment is captured.
- Sellers provide carrier, tracking number and optional custom tracking URL for unsupported carriers.
- Buyers receive a working tracking link via orders UI (notification pipeline will hook into this later).

## Database Additions

- `orders.shipping_method` – human readable carrier/method label.
- `orders.tracking_number` – sanitized tracking identifier (stored uppercase, no spaces).
- `orders.tracking_url` – HTTPS link to carrier tracking.
- Migration file: `supabase/migrations/0007_shipping.sql`.

## API Endpoint

- `POST /api/orders/:orderId/ship`
  - Requires authenticated tenant member (enforced via existing RLS).
  - Payload: `{ carrier, trackingNumber, shippingMethod?, trackingUrl? }`.
  - Carriers mapped via `lib/shipping/track.ts` (InPost, DPD, DHL, UPS, GLS, FedEx, Poczta Polska, Other/manual).
  - Validates UUID, verifies order is `paid` (idempotent if already `shipped`), enforces HTTPS URLs for manual carriers.
  - Sanitises tracking number, derives method label and updates order state to `shipped`.
- Response: `{ order: { id, status, shippingMethod, trackingNumber, trackingUrl, updatedAt, orderGroupId } }`.

## Frontend Component

- `components/admin/orders/ShipDialog.tsx`
  - Client-side dialog with carrier select, tracking inputs, preview of generated link.
  - Uses helper functions (`buildTrackingUrl`, `resolveShippingMethod`, `sanitizeTrackingNumber`).
  - On success, closes dialog and triggers `router.refresh()`; optional `onCompleted` callback for parent state.

## Tests

- `__tests__/orders/shipping.spec.ts`
  - Covers helper sanitisation, successful status transition, unpaid order guard, and manual carrier validation.

## Follow-ups

- Wire buyer notification (email + in-app) once notification service lands.
- Surface shipping data in buyer order detail view.
- Consider capturing `shipped_at` timestamp for SLA reporting.
