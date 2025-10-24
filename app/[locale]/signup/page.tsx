import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

type SignupPageProps = {
  params: { locale: Locale };
};

export default async function SignupPage({ params }: SignupPageProps) {
  const dictionary = await getDictionary(params.locale);

  return (
    <PagePlaceholder
      title={dictionary.navigation.signup}
      description={dictionary.placeholders.signup.description}
      hint="Registration flow with SSR-friendly Supabase coming soon."
    />
  );
}
