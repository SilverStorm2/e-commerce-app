"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/layout/locale-provider";

const DEFAULT_HERO_EXAMPLES = [
  "PLN 420 – Handmade ceramics",
  "PLN 189 – Fair-trade fashion",
  "PLN 349 – Smart home starter",
  "PLN 120 – Natural skincare duo",
] as const;

export function HomeHero() {
  const { dictionary, locale } = useLocale();
  const heroExamples = dictionary.home?.heroExamples ?? DEFAULT_HERO_EXAMPLES;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 md:grid-cols-2 md:py-24 lg:px-6">
        <div className="flex flex-col gap-6">
          <Badge className="w-fit bg-primary/10 text-xs font-semibold uppercase text-primary">
            {dictionary.hero.badge}
          </Badge>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl md:text-5xl">
            {dictionary.hero.title}
          </h1>
          <p className="text-lg text-muted-foreground">{dictionary.hero.subtitle}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" asChild>
              <a href={`/${locale}/marketplace`}>{dictionary.hero.cta}</a>
            </Button>
            <Button variant="ghost" size="lg" asChild>
              <a href={`/${locale}/stories`}>{dictionary.navigation.stories}</a>
            </Button>
          </div>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="grid w-full gap-4 sm:grid-cols-2">
            {heroExamples.map((example, index) => (
              <div
                key={`hero-example-${index}`}
                className="rounded-3xl border border-border bg-card p-6 shadow-sm"
              >
                <p className="text-sm font-medium text-muted-foreground">{example}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
