import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { locales, defaultLocale, type Locale } from "@/lib/i18n/config";
import { getSupabaseConfig } from "@/lib/supabaseConfig";
import type { Database } from "@/types/supabase";

const LOCALE_SET = new Set<string>(locales);
const PROTECTED_SEGMENTS = new Set(["admin", "dashboard"]);
const AUTH_SEGMENTS = new Set(["login", "signup"]);

function getPathSegments(pathname: string): string[] {
  if (!pathname) {
    return [];
  }

  return pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function resolveLocaleFromPath(pathname: string): Locale {
  const [firstSegment] = getPathSegments(pathname);
  if (firstSegment && LOCALE_SET.has(firstSegment)) {
    return firstSegment as Locale;
  }

  return defaultLocale;
}

export function isAuthPath(pathname: string): boolean {
  const segments = getPathSegments(pathname);
  if (segments.length === 0) {
    return false;
  }

  const [maybeLocale, maybeAuth] = segments;
  if (maybeLocale && LOCALE_SET.has(maybeLocale)) {
    return maybeAuth ? AUTH_SEGMENTS.has(maybeAuth) : false;
  }

  return AUTH_SEGMENTS.has(maybeLocale ?? "");
}

export function isProtectedPath(pathname: string): boolean {
  const segments = getPathSegments(pathname);
  if (segments.length === 0) {
    return false;
  }

  const [maybeLocale, maybeProtected] = segments;
  if (maybeLocale && LOCALE_SET.has(maybeLocale)) {
    return maybeProtected ? PROTECTED_SEGMENTS.has(maybeProtected) : false;
  }

  return PROTECTED_SEGMENTS.has(maybeLocale ?? "");
}

function buildRedirectDestination(req: NextRequest, locale: Locale) {
  const target = req.nextUrl.searchParams.get("redirect_to");
  if (target && target.startsWith("/")) {
    return new URL(target, req.url);
  }

  return new URL(`/${locale}/admin`, req.url);
}

function buildLoginRedirect(req: NextRequest, locale: Locale) {
  const redirectUrl = new URL(`/${locale}/login`, req.url);
  const normalizedPath = `${req.nextUrl.pathname}${req.nextUrl.search}`;

  redirectUrl.searchParams.set("redirect_to", normalizedPath || `/${locale}/admin`);

  return redirectUrl;
}

export async function middleware(req: NextRequest) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  const requestHeaders = new Headers(req.headers);
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          const cookieOptions = { ...options, path: options.path ?? "/" };

          req.cookies.set({ name, value });
          requestHeaders.set("cookie", req.cookies.toString());
          res.cookies.set({ name, value, ...cookieOptions });
        });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const locale = resolveLocaleFromPath(req.nextUrl.pathname);
  const protectedRoute = isProtectedPath(req.nextUrl.pathname);
  const authRoute = isAuthPath(req.nextUrl.pathname);

  if (protectedRoute && !session) {
    return NextResponse.redirect(buildLoginRedirect(req, locale));
  }

  if (session && authRoute) {
    return NextResponse.redirect(buildRedirectDestination(req, locale));
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|manifest.json|manifest.webmanifest|sitemap.xml|sw.js).*)",
  ],
};
