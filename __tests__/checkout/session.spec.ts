import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  supabaseClientMock,
  supabaseAuthGetUserMock,
  supabaseFromMock,
  stripeClientMock,
  stripeCheckoutCreateMock,
} = vi.hoisted(() => {
  const authGetUser = vi.fn();
  const from = vi.fn();

  const stripeCreate = vi.fn();
  const stripeClient = {
    checkout: {
      sessions: {
        create: stripeCreate,
      },
    },
  };

  return {
    supabaseClientMock: vi.fn(() => ({
      auth: { getUser: authGetUser },
      from,
    })),
    supabaseAuthGetUserMock: authGetUser,
    supabaseFromMock: from,
    stripeClientMock: vi.fn(() => stripeClient),
    stripeCheckoutCreateMock: stripeCreate,
  };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServerClientWithHeaders: supabaseClientMock,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: stripeClientMock,
}));

vi.mock("@/lib/env", () => ({
  siteUrl: "https://app.example",
}));

let postHandler: typeof import("@/app/api/checkout/session/route").POST;

beforeAll(async () => {
  ({ POST: postHandler } = await import("@/app/api/checkout/session/route"));
});

type SupabaseResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

describe("POST /api/checkout/session", () => {
  let cartResponse: SupabaseResponse<{
    id: string;
    currency_code: string;
    metadata: Record<string, unknown>;
  }>;
  let cartItemsResponse: SupabaseResponse<
    Array<{
      id: string;
      cart_id: string;
      tenant_id: string;
      product_id: string;
      quantity: number;
      unit_price: string;
      currency_code: string;
      metadata: Record<string, unknown>;
      product: {
        id: string;
        tenant_id: string;
        name: string;
        slug: string | null;
        sku: string | null;
        vat_rate: string | null;
        currency_code: string;
      } | null;
    }>
  >;
  let orderGroupInsertPayload: unknown;
  let orderGroupUpdates: unknown[];
  let ordersInsertPayload: any[];
  let ordersUpdates: unknown[];
  let orderItemsInsertPayload: unknown;

  beforeEach(() => {
    supabaseAuthGetUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "buyer@example.com",
          user_metadata: { full_name: "Buyer Example" },
        },
      },
      error: null,
    });

    cartResponse = {
      data: {
        id: "cart-1",
        currency_code: "PLN",
        metadata: {},
      },
      error: null,
    };

    cartItemsResponse = {
      data: [
        {
          id: "cart-item-1",
          cart_id: "cart-1",
          tenant_id: "tenant-1",
          product_id: "product-1",
          quantity: 2,
          unit_price: "120.00",
          currency_code: "PLN",
          metadata: {},
          product: {
            id: "product-1",
            tenant_id: "tenant-1",
            name: "Kubek testowy",
            slug: "kubek-testowy",
            sku: "SKU-1",
            vat_rate: "23",
            currency_code: "PLN",
          },
        },
      ],
      error: null,
    };

    orderGroupInsertPayload = null;
    orderGroupUpdates = [];
    ordersInsertPayload = [];
    ordersUpdates = [];
    orderItemsInsertPayload = null;

    supabaseFromMock.mockImplementation((table: string) => {
      switch (table) {
        case "profiles":
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { full_name: "Buyer Example", default_locale: "pl" },
              error: null,
            }),
          };
        case "carts":
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(cartResponse)),
          };
        case "cart_items":
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation(() => Promise.resolve(cartItemsResponse)),
          };
        case "order_groups":
          return {
            insert: vi.fn().mockImplementation((payload) => {
              orderGroupInsertPayload = payload;
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({
                  data: { id: "og-1", metadata: {} },
                  error: null,
                }),
              };
            }),
            update: vi.fn().mockImplementation((payload) => {
              orderGroupUpdates.push(payload);
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
          };
        case "orders":
          return {
            insert: vi.fn().mockImplementation((payload) => {
              ordersInsertPayload = payload;
              return {
                select: vi.fn().mockResolvedValue({
                  data: payload.map((entry: { tenant_id: string }) => ({
                    id: `order-${entry.tenant_id}`,
                    tenant_id: entry.tenant_id,
                  })),
                  error: null,
                }),
              };
            }),
            update: vi.fn().mockImplementation((payload) => {
              ordersUpdates.push(payload);
              return {
                eq: vi.fn().mockResolvedValue({ data: null, error: null }),
              };
            }),
          };
        case "order_items":
          return {
            insert: vi.fn().mockImplementation((payload) => {
              orderItemsInsertPayload = payload;
              return { error: null };
            }),
          };
        default:
          throw new Error(`Unhandled table: ${table}`);
      }
    });

    stripeCheckoutCreateMock.mockResolvedValue({
      id: "cs_test_123",
      url: "https://stripe.example/session",
      payment_intent: "pi_test_456",
    });
  });

  it("creates a checkout session and persists order data", async () => {
    const request = new NextRequest("https://app.example/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({ locale: "pl" }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const response = await postHandler(request);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      sessionId: "cs_test_123",
      url: "https://stripe.example/session",
      orderGroupId: "og-1",
    });

    expect(orderGroupInsertPayload).toMatchObject({
      buyer_user_id: "user-1",
      items_count: 2,
      seller_count: 1,
      total_amount: "295.20",
      items_subtotal_amount: "240.00",
      items_tax_amount: "55.20",
      metadata: expect.objectContaining({
        locale: "pl",
        seller_count: 1,
      }),
    });

    expect(ordersInsertPayload).toHaveLength(1);
    expect(ordersInsertPayload[0]).toMatchObject({
      tenant_id: "tenant-1",
      items_count: 2,
      total_amount: "295.20",
      metadata: {
        cart_item_ids: ["cart-item-1"],
      },
    });

    expect(orderItemsInsertPayload).toMatchObject([
      expect.objectContaining({
        order_id: "order-tenant-1",
        tenant_id: "tenant-1",
        product_id: "product-1",
        unit_price: "120.00",
        vat_rate: "23.00",
        quantity: 2,
      }),
    ]);

    expect(stripeCheckoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_reference_id: "og-1",
        line_items: [
          expect.objectContaining({
            quantity: 2,
            price_data: expect.objectContaining({
              unit_amount: 14760,
              currency: "pln",
            }),
          }),
        ],
      }),
    );

    expect(orderGroupUpdates).toContainEqual(
      expect.objectContaining({
        status: "awaiting_payment",
      }),
    );
    expect(ordersUpdates).toContainEqual(
      expect.objectContaining({
        status: "awaiting_payment",
      }),
    );
  });

  it("returns 401 when the user is not authenticated", async () => {
    supabaseAuthGetUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "not authenticated" },
    });

    const request = new NextRequest("https://app.example/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await postHandler(request);
    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.error).toMatch(/authentication/i);
  });

  it("returns 400 when the cart is empty", async () => {
    cartResponse = { data: null, error: null };

    const request = new NextRequest("https://app.example/api/checkout/session", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });

    const response = await postHandler(request);
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toMatch(/cart/i);
  });
});
