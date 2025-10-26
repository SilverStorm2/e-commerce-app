import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { mergeGuestCart, type GuestCartItem, type MergeGuestCartArgs } from "@/lib/cart/merge";

type CartMockContext = {
  client: MergeGuestCartArgs["client"];
  fromMock: Mock;
  cartSelectMock: Mock;
  cartEqMock: Mock;
  cartMaybeSingleMock: Mock;
  cartInsertMock: Mock;
  cartInsertSelectMock: Mock;
  cartInsertSingleMock: Mock;
  cartItemsSelectMock: Mock;
  cartItemsEqMock: Mock;
  cartItemsUpsertMock: Mock;
};

function createMockClient(): CartMockContext {
  const cartMaybeSingleMock = vi.fn();
  const cartEqMock = vi.fn(() => ({
    maybeSingle: cartMaybeSingleMock,
  }));
  const cartSelectMock = vi.fn(() => ({
    eq: cartEqMock,
  }));
  const cartInsertSingleMock = vi.fn();
  const cartInsertSelectMock = vi.fn(() => ({
    single: cartInsertSingleMock,
  }));
  const cartInsertMock = vi.fn(() => ({
    select: cartInsertSelectMock,
  }));

  const cartItemsEqMock = vi.fn();
  const cartItemsSelectMock = vi.fn(() => ({
    eq: cartItemsEqMock,
  }));
  const cartItemsUpsertMock = vi.fn();

  const fromMock = vi.fn((table: string) => {
    if (table === "carts") {
      return {
        select: cartSelectMock,
        insert: cartInsertMock,
      };
    }

    if (table === "cart_items") {
      return {
        select: cartItemsSelectMock,
        upsert: cartItemsUpsertMock,
      };
    }

    throw new Error(`Unexpected table requested in mock: ${table}`);
  });

  const client = { from: fromMock } as unknown as MergeGuestCartArgs["client"];

  return {
    client,
    fromMock,
    cartSelectMock,
    cartEqMock,
    cartMaybeSingleMock,
    cartInsertMock,
    cartInsertSelectMock,
    cartInsertSingleMock,
    cartItemsSelectMock,
    cartItemsEqMock,
    cartItemsUpsertMock,
  };
}

describe("mergeGuestCart", () => {
  const userId = "user-1";
  let ctx: CartMockContext;

  beforeEach(() => {
    ctx = createMockClient();
    ctx.cartMaybeSingleMock.mockResolvedValue({ data: null, error: null });
    ctx.cartInsertSingleMock.mockResolvedValue({
      data: {
        id: "cart-123",
        user_id: userId,
        currency_code: "PLN",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });
    ctx.cartItemsEqMock.mockResolvedValue({ data: [], error: null });
    ctx.cartItemsUpsertMock.mockResolvedValue({ data: null, error: null });
  });

  it("creates a cart if missing and merges guest items with existing quantities", async () => {
    ctx.cartItemsEqMock.mockResolvedValue({
      data: [
        {
          product_id: "prod-1",
          quantity: 2,
          metadata: { note: "server" },
          tenant_id: "tenant-1",
          unit_price: "15.00",
        },
      ],
      error: null,
    });

    const guestItems: GuestCartItem[] = [
      { productId: "prod-1", quantity: 3, metadata: { note: "guest" } },
      { productId: "prod-2", quantity: 1, tenantId: "tenant-2", unitPrice: 49.99 },
      { productId: "", quantity: 2 },
    ];

    const result = await mergeGuestCart({
      client: ctx.client,
      userId,
      items: guestItems,
    });

    expect(result.cartId).toBe("cart-123");
    expect(result.merged).toBe(2);
    expect(result.skipped).toHaveLength(1);

    expect(ctx.cartInsertMock).toHaveBeenCalledWith({ user_id: userId });
    expect(ctx.cartItemsUpsertMock).toHaveBeenCalledTimes(1);

    const [payload, options] = ctx.cartItemsUpsertMock.mock.calls[0];
    expect(Array.isArray(payload)).toBe(true);
    expect(options).toEqual({ onConflict: "cart_id,product_id" });

    const mergedByProductId = Object.fromEntries(
      payload.map((row: Record<string, unknown>) => [row.product_id, row]),
    );

    expect(mergedByProductId["prod-1"]).toMatchObject({
      cart_id: "cart-123",
      product_id: "prod-1",
      tenant_id: "tenant-1",
      quantity: 5,
      metadata: { note: "guest" },
      currency_code: "PLN",
      unit_price: "15.00",
    });

    expect(mergedByProductId["prod-2"]).toMatchObject({
      cart_id: "cart-123",
      product_id: "prod-2",
      tenant_id: "tenant-2",
      quantity: 1,
      currency_code: "PLN",
      unit_price: 49.99,
    });
  });

  it("reuses an existing cart when found and skips upsert for empty payloads", async () => {
    ctx.cartMaybeSingleMock.mockResolvedValue({
      data: {
        id: "existing-cart",
        user_id: userId,
        currency_code: "PLN",
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
    });

    const result = await mergeGuestCart({
      client: ctx.client,
      userId,
      items: [],
    });

    expect(result).toEqual({
      cartId: "existing-cart",
      merged: 0,
      skipped: [],
    });

    expect(ctx.cartInsertMock).not.toHaveBeenCalled();
    expect(ctx.cartItemsUpsertMock).not.toHaveBeenCalled();
  });

  it("throws when cart item upsert fails", async () => {
    ctx.cartItemsUpsertMock.mockResolvedValue({
      data: null,
      error: { message: "conflict" },
    });

    await expect(
      mergeGuestCart({
        client: ctx.client,
        userId,
        items: [{ productId: "prod-err", quantity: 1 }],
      }),
    ).rejects.toThrow("Unable to upsert cart items: conflict");
  });
});
