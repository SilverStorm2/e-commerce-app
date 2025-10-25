"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Route } from "next";

import { locales } from "@/lib/i18n/config";
import { useLocale } from "./locale-provider";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const { locale, dictionary } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const handleChange = (nextLocale: string) => {
    if (!nextLocale || nextLocale === locale) {
      return;
    }

    startTransition(() => {
      const segments = pathname.split("/").filter(Boolean);
      const rest = segments.slice(1);
      const target = `/${[nextLocale, ...rest].join("/")}` as Route;
      router.push(target);
    });
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <span>{dictionary.localeSwitcher.label}</span>
      <select
        className={cn(
          "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
          pending && "opacity-70",
        )}
        value={locale}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {option === "pl" ? dictionary.localeSwitcher.polish : dictionary.localeSwitcher.english}
          </option>
        ))}
      </select>
    </label>
  );
}
