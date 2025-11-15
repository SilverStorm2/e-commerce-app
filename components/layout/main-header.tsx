"use client";

import Link from "next/link";

import { useLocale } from "./locale-provider";
import { LocaleSwitcher } from "./locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { SubscribeButton } from "@/components/notifications/SubscribeButton";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { id: "marketplace", href: "/marketplace" },
  { id: "stories", href: "/stories" },
  { id: "contractors", href: "/contractors" },
] as const;

export function MainHeader() {
  const { locale, dictionary } = useLocale();

  return (
    <header className="border-b border-border bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground"
        >
          e-commerce
        </Link>
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((item) => (
            <Link
              key={item.id}
              href={`/${locale}${item.href}`}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {dictionary.navigation[item.id]}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/login`}
            className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:inline-block"
          >
            {dictionary.navigation.login}
          </Link>
          <Link href={`/${locale}/signup`} className={cn(buttonVariants({ size: "sm" }))}>
            {dictionary.navigation.signup}
          </Link>
          <LocaleSwitcher />
          <SubscribeButton />
        </div>
      </nav>
    </header>
  );
}
