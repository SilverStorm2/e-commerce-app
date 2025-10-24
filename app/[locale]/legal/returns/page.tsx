import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type ReturnsPageProps = {
  params: { locale: Locale };
};

export default async function ReturnsPage({ params }: ReturnsPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.pageTitles.legalReturns}
      description={dictionary.placeholders.legalReturns.description}
      hint="Return flows and forms will be wired with the compliance workstream."
    />
  );
}
