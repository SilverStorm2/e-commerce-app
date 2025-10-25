# Auth SSR integration

## Overview

- Supabase auth flows now use `@supabase/ssr` to keep sessions in sync across middleware, server components, and client components.
- Middleware refreshes sessions on each request and enforces access control for `/:locale/admin` and `/:locale/dashboard` URLs.
- Localised login redirects include a `redirect_to` parameter so users land on their intended destination after sign-in.

## Middleware behaviour

- File: `middleware.ts`
- Refreshes cookies via `createServerClient` with proper `getAll`/`setAll` adapters for `NextRequest`/`NextResponse`.
- Derives locale from the pathname, redirecting unauthenticated users to `/{locale}/login`.
- Authenticated users requesting login/signup are redirected to their `redirect_to` target or `/{locale}/admin`.
- Matcher excludes static assets (`_next/static`, images, manifest, SW) to avoid unnecessary execution.

## Supabase client utilities

- Server helpers (`lib/supabaseServer.ts`) expose typed creators that reuse `getSupabaseConfig()`.
- Browser helpers (`lib/supabaseClient.ts`) wrap `createBrowserClient` for client components.
- Shared config lives in `lib/supabaseConfig.ts`; missing environment variables throw early.

## Tests

- Vitest suite (`__tests__/auth/ssr-session.spec.ts`) covers locale detection, protected route handling, and redirect flow for authenticated/unauthenticated users.

## Next steps

- Implement the actual login form to exchange credentials with Supabase and honour the `redirect_to` parameter.
- Extend middleware rules if additional privileged routes (e.g., `/api/internal/*`) are introduced.
