import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type AdminPageProps = {
  params: { locale: Locale };
};

export default async function AdminPage({ params }: AdminPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.navigation.admin}
      description={dictionary.placeholders.admin.description}
      hint={dictionary.placeholders.admin.hint}
    />
  );
}
