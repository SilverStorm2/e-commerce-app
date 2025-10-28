import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  buildTrackingUrl,
  resolveShippingMethod,
  sanitizeTrackingNumber,
} from "@/lib/shipping/track";

type RouteModule = typeof import("@/app/api/orders/[orderId]/ship/route");

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const ORDER_GROUP_ID = "22222222-2222-4222-8222-222222222222";

const { selectSingleMock, updateSingleMock, fromMock, supabaseClient, createSupabaseClientMock } =
  vi.hoisted(() => {
    const selectSingle = vi.fn();
    const updateSingle = vi.fn();

    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingle,
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: () => updateSingle(payload),
          })),
        })),
      })),
    }));

    const client = {
      from,
    };

    return {
      selectSingleMock: selectSingle,
      updateSingleMock: updateSingle,
      fromMock: from,
      supabaseClient: client,
      createSupabaseClientMock: vi.fn(() => client),
    };
  });

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClientWithHeaders: createSupabaseClientMock,
}));

let routeModule: RouteModule;

beforeEach(async () => {
  selectSingleMock.mockReset();
  updateSingleMock.mockReset();
  fromMock.mockClear();
  createSupabaseClientMock.mockClear();

  selectSingleMock.mockResolvedValue({
    data: {
      id: ORDER_ID,
      status: "paid",
      order_group_id: ORDER_GROUP_ID,
    },
    error: null,
  });

  updateSingleMock.mockImplementation(async (payload: Record<string, unknown>) => ({
    data: {
      id: ORDER_ID,
      status: "shipped",
      shipping_method: payload.shipping_method ?? null,
      tracking_number: payload.tracking_number ?? null,
      tracking_url: payload.tracking_url ?? null,
      updated_at: "2025-10-28T05:30:00.000Z",
      order_group_id: ORDER_GROUP_ID,
    },
    error: null,
  }));

  routeModule = await import("@/app/api/orders/[orderId]/ship/route");
});

describe("shipping helpers", () => {
  it("builds carrier tracking URLs with sanitized numbers", () => {
    const url = buildTrackingUrl("inpost", sanitizeTrackingNumber("  aa123  "));
    expect(url).toBe("https://inpost.pl/sledzenie-przesylek?number=AA123");
  });

  it("falls back to manual method label when none provided", () => {
    const method = resolveShippingMethod("dpd", "");
    expect(method).toBe("DPD Polska");
  });
});

describe("POST /api/orders/[orderId]/ship", () => {
  it("marks an order as shipped and returns updated metadata", async () => {
    const request = new Request("https://app.example/api/orders/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "inpost",
        trackingNumber: " 123abc ",
        shippingMethod: "",
      }),
    });

    const response = await routeModule.POST(request as any, {
      params: { orderId: ORDER_ID },
    });

    expect(response.status).toBe(200);
    const payload = await response.json();

    expect(payload.order).toMatchObject({
      status: "shipped",
      trackingNumber: "123ABC",
      shippingMethod: "InPost",
    });

    expect(updateSingleMock).toHaveBeenCalledTimes(1);
    const updateCallPayload = updateSingleMock.mock.calls[0][0];
    expect(updateCallPayload).toMatchObject({
      status: "shipped",
      shipping_method: "InPost",
      tracking_number: "123ABC",
    });
  });

  it("returns 409 when the order is not yet paid", async () => {
    selectSingleMock.mockResolvedValueOnce({
      data: {
        id: ORDER_ID,
        status: "pending",
        order_group_id: ORDER_GROUP_ID,
      },
      error: null,
    });

    const request = new Request("https://app.example/api/orders/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "inpost",
        trackingNumber: "123",
      }),
    });

    const response = await routeModule.POST(request as any, {
      params: { orderId: ORDER_ID },
    });

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toMatch(/paid/i);
    expect(updateSingleMock).not.toHaveBeenCalled();
  });

  it("validates manual carrier URLs", async () => {
    const request = new Request("https://app.example/api/orders/ship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: "other",
        trackingNumber: "PL123",
        trackingUrl: "http://insecure.example.com",
      }),
    });

    const response = await routeModule.POST(request as any, {
      params: { orderId: ORDER_ID },
    });

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/tracking url/i);
    expect(updateSingleMock).not.toHaveBeenCalled();
  });
});
