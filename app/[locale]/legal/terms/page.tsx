import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type TermsPageProps = {
  params: { locale: Locale };
};

export default async function TermsPage({ params }: TermsPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.pageTitles.legalTerms}
      description={dictionary.placeholders.legalTerms.description}
      hint={dictionary.placeholders.legalTerms.hint}
    />
  );
}
