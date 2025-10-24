"use client";

import { HomeHero } from "./home-hero";

export function HomeLanding() {
  return (
    <div className="flex flex-col gap-24">
      <HomeHero />
      <section className="bg-background">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-24 lg:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            Built for modern Polish and European sellers
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const FEATURES = [
  {
    title: "Multi-seller checkout",
    description:
      "Split orders per seller with a single pay-in, ready for PLN payments and manual reconciliation.",
  },
  {
    title: "Realtime community",
    description:
      "Threads, DMs, and store updates keep buyers engaged and accountable. Moderation queue included.",
  },
  {
    title: "Compliance-first",
    description:
      "GDPR-ready data flows, Omnibus disclosures, rate limiting, and audit trails from day zero.",
  },
];
