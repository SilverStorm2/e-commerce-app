import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type LoginPageProps = {
  params: { locale: Locale };
};

export default async function LoginPage({ params }: LoginPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.navigation.login}
      description={dictionary.placeholders.login.description}
      hint="Supabase-authenticated login screen coming soon."
    />
  );
}
