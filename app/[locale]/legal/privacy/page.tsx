import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type PrivacyPageProps = {
  params: { locale: Locale };
};

export default async function PrivacyPage({ params }: PrivacyPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.pageTitles.legalPrivacy}
      description={dictionary.placeholders.legalPrivacy.description}
      hint="Full privacy policy draft will land with compliance milestone."
    />
  );
}
