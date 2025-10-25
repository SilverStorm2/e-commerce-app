import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StoreActions } from "@/components/storefront/store-actions";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { type Locale, locales } from "@/lib/i18n/config";
import { formatPrice, resolvePublicStorageUrl } from "@/lib/storefront";
import { createSupabaseServerClientWithHeaders } from "@/lib/supabaseServer";
import {
  getProductBySlug,
  getTenantBySlug,
  type StorefrontProduct,
} from "@/app/[locale]/[tenant]/queries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductPageParams = {
  locale: Locale;
  tenant: string;
  id: string;
};

type ProductPageProps = {
  params: ProductPageParams;
};

function ensureLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}

function splitMedia(product: StorefrontProduct) {
  if (!product.media || product.media.length === 0) {
    return { cover: null, gallery: [] as typeof product.media };
  }

  const cover = product.media.find((media) => media.is_primary) ?? product.media[0];
  const gallery = product.media.filter((media) => media.id !== cover.id);

  return { cover, gallery };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
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

  const product = await getProductBySlug(supabase, store.id, params.id);
  if (!product) {
    return {
      title: dictionary.storefront.productNotFoundTitle,
      description: dictionary.storefront.productNotFoundDescription,
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    title: `${product.name} — ${store.name}`,
    description:
      product.seo_description ??
      product.short_description ??
      dictionary.storefront.metaDescriptionFallback,
    alternates: {
      canonical: `${siteUrl}/${params.locale}/${store.slug}/product/${product.slug}`,
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
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

  const product = await getProductBySlug(supabase, store.id, params.id);
  if (!product) {
    notFound();
  }

  const { cover, gallery } = splitMedia(product);
  const coverUrl = resolvePublicStorageUrl(supabase, cover?.storage_path);
  const coverAlt = cover?.alt_text ?? product.name;
  const galleryWithUrls = gallery
    .map((media) => ({
      id: media.id,
      alt: media.alt_text ?? product.name,
      url: resolvePublicStorageUrl(supabase, media.storage_path),
    }))
    .filter((media) => Boolean(media.url));

  const redirectPath = `/${params.locale}/${store.slug}/product/${product.slug}`;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 md:px-6 md:py-16">
      <nav aria-label={dictionary.storefront.breadcrumbLabel}>
        <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link href={`/${params.locale}/marketplace`} className="hover:text-foreground">
              {dictionary.navigation.marketplace}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href={`/${params.locale}/${store.slug}`} className="hover:text-foreground">
              {store.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-foreground">{product.name}</li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section aria-label={dictionary.storefront.galleryLabel} className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={coverAlt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 40vw, 80vw"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <span className="text-sm font-medium uppercase tracking-wide">
                  {dictionary.storefront.mediaPlaceholder}
                </span>
                <span className="text-xs">{dictionary.storefront.mediaPlaceholderHint}</span>
              </div>
            )}
          </div>

          {galleryWithUrls.length > 0 ? (
            <ul className="grid grid-cols-3 gap-3">
              {galleryWithUrls.map((media) => (
                <li key={media.id}>
                  <Image
                    src={media.url as string}
                    alt={media.alt}
                    width={160}
                    height={160}
                    className="h-full w-full rounded-lg border border-border object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {product.name}
            </h1>
            <div>
              <span className="text-sm uppercase tracking-wide text-muted-foreground">
                {dictionary.storefront.priceLabel}
              </span>
              <p className="text-2xl font-semibold text-foreground">
                {formatPrice(product.price_amount, params.locale, product.currency_code)}
              </p>
            </div>
          </div>

          <StoreActions
            locale={params.locale}
            storeId={store.id}
            storeSlug={store.slug}
            dictionary={dictionary}
            session={sessionData.session}
            redirectPath={redirectPath}
          />

          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-foreground">
              {dictionary.storefront.descriptionHeading}
            </h2>
            {product.description ? (
              <p className="text-base leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            ) : product.short_description ? (
              <p className="text-base leading-relaxed text-muted-foreground">
                {product.short_description}
              </p>
            ) : (
              <p className="text-base text-muted-foreground">
                {dictionary.storefront.descriptionFallback}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-muted-foreground/20 bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              {dictionary.storefront.stockStatusLabel}:{" "}
              <span className="font-medium text-foreground">
                {dictionary.storefront.stockStatusUnknown}
              </span>
            </p>
            <Link
              href={`/${params.locale}/${store.slug}`}
              className="font-medium text-primary hover:underline"
            >
              {dictionary.storefront.backToStoreCta}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
