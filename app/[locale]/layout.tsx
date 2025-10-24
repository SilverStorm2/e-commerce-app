import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LocaleProvider } from "@/components/layout/locale-provider";
import { MainShell } from "@/components/layout/main-shell";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: { locale: string };
};

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const locale = (params.locale ?? defaultLocale) as Locale;
  if (!locales.includes(locale)) {
    return {};
  }

  const dictionary = await getDictionary(locale);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages: Object.fromEntries(
        locales.map((code) => [code, `${siteUrl}/${code}`]),
      ),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const locale = params.locale as Locale;

  if (!locales.includes(locale)) {
    notFound();
  }

  const dictionary = await getDictionary(locale);

  return (
    <LocaleProvider locale={locale} dictionary={dictionary}>
      <MainShell>{children}</MainShell>
    </LocaleProvider>
  );
}
