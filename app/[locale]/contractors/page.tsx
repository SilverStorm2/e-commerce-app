import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type ContractorsPageProps = {
  params: { locale: Locale };
};

export default async function ContractorsPage({
  params,
}: ContractorsPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.navigation.contractors}
      description={dictionary.placeholders.contractors.description}
      hint="Contractor discovery modules under construction."
    />
  );
}
