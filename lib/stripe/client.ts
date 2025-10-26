import Stripe from "stripe";

import { getServerEnv } from "@/lib/env.server";

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedClient) {
    return cachedClient;
  }

  const secretKey = getServerEnv("STRIPE_SECRET_KEY");
  cachedClient = new Stripe(secretKey, {
    apiVersion: "2023-10-16",
    appInfo: {
      name: "Marketplace Checkout",
      version: "0.1.0",
    },
  });

  return cachedClient;
}
