"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/layout/locale-provider";

export function HomeHero() {
  const { dictionary, locale } = useLocale();

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
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">
                PLN 420 - Handmade ceramics
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">
                PLN 189 - Fair-trade fashion
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">
                PLN 349 - Smart home starter
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground">
                PLN 120 - Natural skincare duo
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
