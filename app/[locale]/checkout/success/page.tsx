import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type SuccessPageProps = {
  params: { locale: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function CheckoutSuccessPage({ params, searchParams }: SuccessPageProps) {
  const dictionary = await getDictionary(params.locale);
  const copy = dictionary.checkout.success;
  const orderReference =
    typeof searchParams?.order === "string" && searchParams.order.trim().length > 0
      ? searchParams.order.trim()
      : null;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:gap-6 sm:py-24">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
      <p className="text-base text-muted-foreground sm:text-lg">{copy.description}</p>
      <p className="text-sm text-muted-foreground sm:text-base">{copy.nextSteps}</p>

      {orderReference ? (
        <div className="mt-2 flex flex-col items-center gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {copy.referenceLabel}
          </span>
          <span className="rounded-md border border-border bg-muted px-3 py-1 text-sm font-mono text-muted-foreground">
            {orderReference}
          </span>
        </div>
      ) : null}

      <Link
        href={`/${params.locale}/marketplace`}
        className={cn(buttonVariants({ size: "lg" }), "mt-6")}
      >
        {copy.cta}
      </Link>
    </div>
  );
}
