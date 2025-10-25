import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreActions } from "@/components/storefront/store-actions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { type Locale, locales } from "@/lib/i18n/config";
import { formatPrice, resolvePublicStorageUrl } from "@/lib/storefront";
import { createSupabaseServerClientWithHeaders } from "@/lib/supabaseServer";
import type { StorefrontProduct } from "@/app/[locale]/[tenant]/queries";
import { getTenantBySlug, getPublishedProductsForTenant } from "@/app/[locale]/[tenant]/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StorefrontPageParams = {
  locale: Locale;
  tenant: string;
};

type StorefrontPageProps = {
  params: StorefrontPageParams;
};

function ensureLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}

function selectPrimaryMedia(product: StorefrontProduct) {
  if (!product.media || product.media.length === 0) {
    return null;
  }

  const [first] = product.media;
  if (!first) {
    return null;
  }

  if (first.is_primary) {
    return first;
  }

  const primary = product.media.find((media) => media.is_primary);
  return primary ?? first;
}

export async function generateMetadata({ params }: StorefrontPageProps): Promise<Metadata> {
  if (!ensureLocale(params.locale)) {
    return {};
  }

  const dictionary = await getDictionary(params.locale);
  const supabase = createSupabaseServerClientWithHeaders();
  const store = await getTenantBySlug(supabase, params.tenant);

  if (!store) {
    return {
      title: dictionary.storefront.notFoundTitle,
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    title: `${store.name} — ${dictionary.storefront.metaTitleSuffix}`,
    description: store.description ?? dictionary.storefront.metaDescriptionFallback,
    alternates: {
      canonical: `${siteUrl}/${params.locale}/${store.slug}`,
    },
  };
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  if (!ensureLocale(params.locale)) {
    notFound();
  }

  const dictionary = await getDictionary(params.locale);
  const supabase = createSupabaseServerClientWithHeaders();
  const [{ data: sessionData }, store] = await Promise.all([
    supabase.auth.getSession(),
    getTenantBySlug(supabase, params.tenant),
  ]);

  if (!store) {
    notFound();
  }

  const products = await getPublishedProductsForTenant(supabase, store.id);
  const productsWithMedia = products.map((product) => {
    const primaryMedia = selectPrimaryMedia(product);
    return {
      product,
      coverUrl: resolvePublicStorageUrl(supabase, primaryMedia?.storage_path),
      coverAlt: primaryMedia?.alt_text ?? product.name,
    };
  });

  const redirectPath = `/${params.locale}/${store.slug}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 md:px-6 md:py-16">
      <nav aria-label={dictionary.storefront.breadcrumbLabel}>
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link href={`/${params.locale}/marketplace`} className="hover:text-foreground">
              {dictionary.navigation.marketplace}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">{store.name}</li>
        </ol>
      </nav>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="flex-1">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {store.name}
          </h1>
          {store.description ? (
            <p className="mt-3 text-base text-muted-foreground">{store.description}</p>
          ) : null}
        </div>
        <StoreActions
          locale={params.locale}
          storeId={store.id}
          storeSlug={store.slug}
          dictionary={dictionary}
          session={sessionData.session}
          redirectPath={redirectPath}
        />
      </header>

      <section aria-labelledby="storefront-products-heading" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 id="storefront-products-heading" className="text-2xl font-semibold text-foreground">
            {dictionary.storefront.productListHeading}
          </h2>
          <p className="text-sm text-muted-foreground">
            {dictionary.storefront.productListDescription}
          </p>
        </div>

        {productsWithMedia.length === 0 ? (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 p-8 text-center">
            <h3 className="text-lg font-medium text-foreground">
              {dictionary.storefront.emptyStateTitle}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {dictionary.storefront.emptyStateDescription}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {productsWithMedia.map(({ product, coverUrl, coverAlt }) => (
              <Link
                key={product.id}
                href={`/${params.locale}/${store.slug}/product/${product.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] w-full bg-muted">
                  {coverUrl ? (
                    <Image
                      src={coverUrl}
                      alt={coverAlt}
                      fill
                      sizes="(min-width: 1024px) 25vw, (min-width: 640px) 40vw, 90vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20 text-muted-foreground">
                      <span className="text-sm font-medium uppercase tracking-wide">
                        {dictionary.storefront.mediaPlaceholder}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold text-foreground transition group-hover:text-primary">
                      {product.name}
                    </h3>
                    {product.short_description ? (
                      <p className="text-sm text-muted-foreground">{product.short_description}</p>
                    ) : null}
                  </div>
                  <div className="mt-auto flex items-center justify-between text-sm">
                    <span className="text-base font-medium text-foreground">
                      {formatPrice(product.price_amount, params.locale, product.currency_code)}
                    </span>
                    <span className="font-medium text-primary group-hover:underline">
                      {dictionary.storefront.viewProductCta}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
