import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type StoriesPageProps = {
  params: { locale: Locale };
};

export default async function StoriesPage({ params }: StoriesPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.navigation.stories}
      description={dictionary.placeholders.stories.description}
      hint={dictionary.placeholders.stories.hint}
    />
  );
}
