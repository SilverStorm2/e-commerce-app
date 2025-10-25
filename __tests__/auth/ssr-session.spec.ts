import { NextRequest } from "next/server";
import { describe, expect, beforeEach, it, vi } from "vitest";

import { isAuthPath, isProtectedPath, middleware, resolveLocaleFromPath } from "@/middleware";

type SessionResult =
  | {
      data: { session: { user: { id: string } } };
    }
  | {
      data: { session: null };
    };

const getSessionMock = vi.fn<[], Promise<SessionResult>>();

vi.mock("@supabase/ssr", () => {
  return {
    createServerClient: vi.fn(() => ({
      auth: {
        getSession: getSessionMock,
      },
    })),
  };
});

describe("auth middleware helpers", () => {
  it("derives locale from path prefix", () => {
    expect(resolveLocaleFromPath("/pl/admin")).toBe("pl");
    expect(resolveLocaleFromPath("/en/anything")).toBe("en");
    expect(resolveLocaleFromPath("/unknown/route")).toBe("pl");
  });

  it("detects protected segments", () => {
    expect(isProtectedPath("/pl/admin")).toBe(true);
    expect(isProtectedPath("/en/dashboard/settings")).toBe(true);
    expect(isProtectedPath("/pl/stores")).toBe(false);
  });

  it("detects auth routes", () => {
    expect(isAuthPath("/pl/login")).toBe(true);
    expect(isAuthPath("/en/signup")).toBe(true);
    expect(isAuthPath("/pl/stores")).toBe(false);
  });
});

describe("middleware", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    getSessionMock.mockReset();
  });

  it("redirects unauthenticated users from protected routes", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });

    const request = new NextRequest("https://app.local/pl/admin");

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://app.local/pl/login?redirect_to=%2Fpl%2Fadmin",
    );
  });

  it("allows access to protected routes with an active session", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });

    const request = new NextRequest("https://app.local/pl/admin");

    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends authenticated users away from login to their redirect target", async () => {
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-2" } } } });

    const request = new NextRequest("https://app.local/pl/login?redirect_to=/pl/admin");

    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://app.local/pl/admin");
  });
});
