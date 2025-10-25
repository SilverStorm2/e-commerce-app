import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/search/route";

const { rpcMock, createSupabaseServerClientWithHeadersMock } = vi.hoisted(() => {
  const rpc = vi.fn<
    [string, Record<string, unknown>],
    Promise<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>
  >();
  const createClient = vi.fn(() => ({
    rpc,
  }));

  return { rpcMock: rpc, createSupabaseServerClientWithHeadersMock: createClient };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClientWithHeaders: createSupabaseServerClientWithHeadersMock,
}));

describe("Search API contractor visibility", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createSupabaseServerClientWithHeadersMock.mockClear();
  });

  it("returns contractor results with structured payload", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          entity_type: "contractor",
          entity_id: "contractor-1",
          tenant_id: null,
          slug: "anna-nowak",
          title: "Anna Nowak",
          subtitle: "UX designer",
          snippet: null,
          rank: 0.82,
          payload: {
            type: "contractor",
            user_id: "user-1",
            skills: ["design", "store_setup"],
            service_areas: ["remote"],
            languages: ["pl", "en"],
          },
        },
      ],
      error: null,
    });

    const request = new NextRequest(
      "https://app.local/api/search?q=design&type=contractor&limit=10&locale=pl",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({
      type: "contractor",
      id: "contractor-1",
      slug: "anna-nowak",
      payload: expect.objectContaining({
        type: "contractor",
        skills: ["design", "store_setup"],
        service_areas: ["remote"],
      }),
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "search_entities",
      expect.objectContaining({
        include_contractors: true,
        include_products: false,
      }),
    );
  });
});
