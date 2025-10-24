# ADR-0001: Application Structure and Locale Routing

## Status

Accepted — 2025-10-24

## Context

The marketplace MVP must support Polish and English experiences from day one, operate within the Next.js App Router, and keep Supabase as the system of record. We also need to accommodate shadcn/ui patterns, Tailwind v4 theming, and upcoming domain features (multi-seller checkout, social feeds, moderation). Locale-specific experiences should feel native while still sharing a single React tree for analytics, layout primitives, and provider wiring.

## Decision

1. **App Router with locale segment** — We expose `/[locale]/…` as the primary entry point and keep `/` as a redirect to the default locale (`pl`). The `[locale]` segment is a server layout that:
   - Validates locale membership (`pl`, `en`) and issues `notFound()` for unsupported codes.
   - Fetches the locale dictionary server-side and hydrates a client `LocaleProvider`.
   - Wraps children in a shared `MainShell` that renders navigation, footer, and shared UI primitives.
2. **Tailwind v4 + shadcn/ui primitives** — Global styles define CSS custom properties for light/dark surfaces and re-export shadcn primitives (`Button`, `Badge`, layout helpers). Tailwind content paths focus on `app`, `components`, and `lib` folders to keep tree‑shaking efficient.
3. **Env awareness** — Client-safe environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`) are read via `lib/env.ts`, enabling future Supabase wiring without leaking secrets to the browser bundle.
4. **Placeholder routes aligned to roadmap** — Marketplace, contractors, legal, and auth pages live within the locale segment as stubs. These placeholders set expectations for downstream agents while enabling integration tests to hook into consistent paths.

## Consequences

- Frontend agents can iterate on domain pages without reworking routing.
- SSR metadata can pull from dictionaries for localized titles and descriptions.
- The shared `LocaleProvider` allows client components (e.g., locale switcher, hero copy) to read translations without extra fetches.
- Tests can mount UI in isolation by providing the provider + dictionary, keeping Vitest snapshots deterministic.
