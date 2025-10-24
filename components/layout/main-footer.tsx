"use client";

import Link from "next/link";

import { useLocale } from "./locale-provider";

export function MainFooter() {
  const { dictionary, locale } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <p>{dictionary.footer.rights.replace("{year}", String(year))}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/${locale}/legal/privacy`} className="hover:text-foreground">
            Privacy
          </Link>
          <Link href={`/${locale}/legal/terms`} className="hover:text-foreground">
            Terms
          </Link>
          <Link href={`/${locale}/legal/returns`} className="hover:text-foreground">
            Returns
          </Link>
        </div>
      </div>
    </footer>
  );
}
