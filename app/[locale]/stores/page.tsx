import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type StoresPageProps = {
  params: { locale: Locale };
};

export default async function StoresPage({ params }: StoresPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.pageTitles.stores}
      description={dictionary.placeholders.stores.description}
      hint={dictionary.placeholders.stores.hint}
    />
  );
}
