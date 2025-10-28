import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

type RouteModule = typeof import("@/app/api/stripe/webhook/route");

const { constructEventMock, supabaseRpcMock, supabaseClientFactoryMock, stripeClientFactoryMock } =
  vi.hoisted(() => {
    const constructEvent = vi.fn();
    const supabaseRpc = vi.fn();

    return {
      constructEventMock: constructEvent,
      supabaseRpcMock: supabaseRpc,
      supabaseClientFactoryMock: vi.fn(() => ({
        rpc: supabaseRpc,
      })),
      stripeClientFactoryMock: vi.fn(() => ({
        webhooks: {
          constructEvent,
        },
      })),
    };
  });

vi.mock("@/lib/stripe/client", () => ({
  getStripeClient: stripeClientFactoryMock,
}));

vi.mock("@/lib/supabaseServiceRole", () => ({
  getSupabaseServiceRoleClient: supabaseClientFactoryMock,
}));

let routeModule: RouteModule;

beforeAll(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_test";

  routeModule = await import("@/app/api/stripe/webhook/route");
});

beforeEach(() => {
  constructEventMock.mockReset();
  supabaseRpcMock.mockReset();
});

describe("POST /api/stripe/webhook", () => {
  it("reconciles checkout.session completed events", async () => {
    const event = {
      id: "evt_123",
      type: "checkout.session.completed",
      created: 1730070934,
      data: {
        object: {
          id: "cs_test_123",
          metadata: {
            order_group_id: "og-123",
          },
          client_reference_id: "og-123",
          payment_intent: "pi_123",
          amount_total: 29520,
          currency: "pln",
          payment_status: "paid",
          mode: "payment",
        },
      },
    } satisfies Stripe.Event;

    constructEventMock.mockReturnValue(event);
    supabaseRpcMock.mockResolvedValue({
      data: {
        order_group_id: "og-123",
        applied: true,
      },
      error: null,
    });

    const payload = JSON.stringify({ id: "cs_test_123" });
    const request = new Request("https://example.com/api/stripe/webhook", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": "t=123,v1=signature",
      },
    });

    const response = await routeModule.POST(request);

    expect(response.status).toBe(200);
    expect(constructEventMock).toHaveBeenCalledWith(payload, "t=123,v1=signature", "whsec_test");
    expect(supabaseRpcMock).toHaveBeenCalledWith(
      "reconcile_order_group_payment",
      expect.objectContaining({
        p_order_group_id: "og-123",
        p_payment_intent: "pi_123",
        p_amount_total: 295.2,
        p_currency_code: "PLN",
      }),
    );

    const body = await response.json();
    expect(body).toMatchObject({
      received: true,
      orderGroupId: "og-123",
      applied: true,
    });
  });

  it("returns 400 when signature is missing", async () => {
    const request = new Request("https://example.com/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });

    const response = await routeModule.POST(request);
    expect(response.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
    expect(supabaseRpcMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error).toMatch(/signature/i);
  });

  it("returns 500 when reconciliation fails", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_456",
      type: "checkout.session.completed",
      created: 1730070934,
      data: {
        object: {
          id: "cs_test_456",
          metadata: {
            order_group_id: "og-456",
          },
          payment_intent: "pi_456",
          amount_total: 1000,
          currency: "pln",
        },
      },
    } satisfies Stripe.Event);

    supabaseRpcMock.mockResolvedValue({
      data: null,
      error: { message: "failure" },
    });

    const request = new Request("https://example.com/api/stripe/webhook", {
      method: "POST",
      body: "{}",
      headers: {
        "stripe-signature": "sig_header",
      },
    });

    const response = await routeModule.POST(request);
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toMatch(/reconciliation/i);
  });
});
