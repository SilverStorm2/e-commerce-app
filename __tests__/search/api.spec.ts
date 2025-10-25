import { NextRequest } from "next/server";
import { describe, expect, beforeEach, it, vi } from "vitest";

import { GET } from "@/app/api/search/route";

type RpcResult<T> =
  | {
      data: T;
      error: null;
    }
  | {
      data: null;
      error: { message: string };
    };

const { rpcMock, createSupabaseServerClientWithHeadersMock } = vi.hoisted(() => {
  const rpc = vi.fn<[string, Record<string, unknown>], Promise<RpcResult<unknown[]>>>();
  const createClient = vi.fn(() => ({
    rpc,
  }));
  return { rpcMock: rpc, createSupabaseServerClientWithHeadersMock: createClient };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClientWithHeaders: createSupabaseServerClientWithHeadersMock,
}));

describe("GET /api/search", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    createSupabaseServerClientWithHeadersMock.mockClear();
  });

  it("returns 400 when query parameter is missing", async () => {
    const request = new NextRequest("https://app.local/api/search");
    const response = await GET(request);

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/missing query/i);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("invokes Supabase RPC with defaults and maps results", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          entity_type: "product",
          entity_id: "prod-1",
          tenant_id: "tenant-1",
          slug: "kubek",
          title: "Kubek",
          subtitle: "Ceramiczny kubek",
          snippet: null,
          rank: 0.87,
          payload: { price_amount: 129.0, currency_code: "PLN" },
        },
      ],
      error: null,
    });

    const request = new NextRequest("https://app.local/api/search?q=kubek");
    const response = await GET(request);

    expect(createSupabaseServerClientWithHeadersMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("search_entities", {
      search_term: "kubek",
      locale: "pl",
      include_products: true,
      include_contractors: true,
      limit_count: 20,
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({
      type: "product",
      id: "prod-1",
      tenantId: "tenant-1",
      slug: "kubek",
      rank: 0.87,
    });
  });

  it("respects type filters and limit parameter", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const request = new NextRequest(
      "https://app.local/api/search?q=logistyka&type=contractor&limit=5&locale=en",
    );
    await GET(request);

    expect(rpcMock).toHaveBeenCalledWith("search_entities", {
      search_term: "logistyka",
      locale: "en",
      include_products: false,
      include_contractors: true,
      limit_count: 5,
    });
  });

  it("clamps invalid limit values", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    const request = new NextRequest("https://app.local/api/search?q=coś&limit=500");
    await GET(request);

    expect(rpcMock).toHaveBeenCalledWith("search_entities", {
      search_term: "coś",
      locale: "pl",
      include_products: true,
      include_contractors: true,
      limit_count: 50,
    });
  });

  it("surfaces 500 when Supabase returns an error", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "failure" },
    });

    const request = new NextRequest("https://app.local/api/search?q=kubek");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.error).toMatch(/failed/i);
  });
});
