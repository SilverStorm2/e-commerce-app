# PWA foundation overview

## Scope

- `public/manifest.json` exposes the application name, theme colour, standalone display mode and `pl` default start URL. Two maskable SVG icons cover 192px+ and 512px+ install requirements.
- `public/sw.js` pre-caches the locale home shells (`/`, `/pl`, `/en`) and manifest. Navigation requests are served network-first with an offline fallback that prefers the cached request, then the matching locale shell before defaulting to `/pl` or `/`. Requests for `/_next/` assets are handled network-first to prevent stale bundles during development refreshes.
- `components/pwa/service-worker-register.tsx` registers the worker on the client and refreshes it whenever the tab regains focus so cached assets stay fresh.

## Usage

- The worker is registered once via `MainShell`, so any page rendered under `app/[locale]/*` inherits offline support.
- During development the worker also registers on `localhost`, making it easy to test installability via browser DevTools (Application -> Manifest).
- Run `npm run test` to execute the Vitest suite, including:
  - `__tests__/pwa/installable.spec.ts` -> validates manifest metadata and shell caching entries.
  - `__tests__/i18n/locale-switch.spec.ts` -> ensures PL/EN parity for navigation and placeholder copy.

## Future enhancements

- Expand cached routes as new critical flows ship (e.g. marketplace listing, login).
- Add background sync for cart mutations (see milestone `M7-PWA-PLUS`).
- Generate PNG icons/assets directly from the design system once branding solidifies.
