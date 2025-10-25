import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type MarketplacePageProps = {
  params: { locale: Locale };
};

export default async function MarketplacePage({ params }: MarketplacePageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.navigation.marketplace}
      description={dictionary.placeholders.marketplace.description}
      hint={dictionary.placeholders.marketplace.hint}
    />
  );
}
