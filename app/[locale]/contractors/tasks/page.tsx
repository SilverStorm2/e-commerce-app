import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type ContractorTasksPageProps = {
  params: { locale: Locale };
};

export default async function ContractorTasksPage({ params }: ContractorTasksPageProps) {
  const dictionary = await getDictionary(params.locale);
  const tasksCopy = dictionary.contractors.tasks;

  return (
    <PagePlaceholder
      title={tasksCopy.title}
      description={tasksCopy.description}
      hint={tasksCopy.hint}
    />
  );
}
