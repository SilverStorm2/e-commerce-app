import Link from "next/link";

import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type dictionaryPl from "@/locales/pl.json";
import {
  CONTRACTOR_SERVICE_AREAS,
  CONTRACTOR_SKILLS,
  isContractorServiceArea,
  isContractorSkill,
} from "@/lib/contractors/constants";
import { ContractorCard } from "@/components/contractors/contractor-card";
import {
  type ContractorDirectoryFilters,
  type ContractorDirectoryProfile,
  searchContractorProfiles,
} from "./queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContractorsPageProps = {
  params: { locale: Locale };
  searchParams?: Record<string, string | string[] | undefined>;
};

type ContractorsDictionary = typeof dictionaryPl.contractors;

function pickFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function formatCount(copy: ContractorsDictionary, count: number): string | null {
  const template = copy.directory?.countLabel;
  if (!template) {
    return null;
  }

  return template.replace("{count}", count.toString());
}

function buildFilters(
  searchParams: ContractorsPageProps["searchParams"],
): Pick<ContractorDirectoryFilters, "searchTerm" | "skill" | "serviceArea"> {
  const searchTerm = pickFirst(searchParams?.q)?.trim();
  const rawSkill = pickFirst(searchParams?.skill);
  const rawArea = pickFirst(searchParams?.area);

  const skill = isContractorSkill(rawSkill) ? rawSkill : undefined;
  const serviceArea = isContractorServiceArea(rawArea) ? rawArea : undefined;

  return {
    searchTerm: searchTerm && searchTerm.length > 0 ? searchTerm : undefined,
    skill,
    serviceArea,
  };
}

export default async function ContractorsPage({ params, searchParams }: ContractorsPageProps) {
  const { locale } = params;
  const dictionary = await getDictionary(locale);
  const contractorsDictionary = dictionary.contractors;

  const supabase = createSupabaseServerClient();
  const filters = buildFilters(searchParams);

  let contractors: ContractorDirectoryProfile[] = [];
  let loadError = false;

  try {
    contractors = await searchContractorProfiles(supabase, filters);
  } catch (error) {
    console.error("Failed to load contractor directory", error);
    loadError = true;
  }

  const searchInputValue = filters.searchTerm ?? "";
  const selectedSkill = filters.skill ?? "";
  const selectedArea = filters.serviceArea ?? "";
  const showReset = Boolean(searchInputValue || selectedSkill || selectedArea);
  const countLabel = formatCount(contractorsDictionary, contractors.length);

  const skillOptions = CONTRACTOR_SKILLS.map((value) => ({
    value,
    label: contractorsDictionary.filters.skills?.[value] ?? value,
  }));

  const serviceAreaOptions = CONTRACTOR_SERVICE_AREAS.map((value) => ({
    value,
    label: contractorsDictionary.filters.serviceAreas?.[value] ?? value,
  }));

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 md:px-6 md:py-16">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {contractorsDictionary.directory.title}
          </h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">
            {contractorsDictionary.directory.subtitle}
          </p>
        </div>
        <Link
          href={`/${locale}/contractors/tasks`}
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          {contractorsDictionary.directory.tasksCta}
        </Link>
      </header>

      <form
        action=""
        method="get"
        className="flex flex-col gap-6 rounded-xl border border-border bg-background/60 p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-1">
            <label htmlFor="contractor-search" className="text-sm font-medium text-foreground">
              {contractorsDictionary.filters.searchLabel}
            </label>
            <input
              id="contractor-search"
              type="search"
              name="q"
              defaultValue={searchInputValue}
              placeholder={contractorsDictionary.filters.searchPlaceholder}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label htmlFor="contractor-skill" className="text-sm font-medium text-foreground">
              {contractorsDictionary.filters.skillLabel}
            </label>
            <select
              id="contractor-skill"
              name="skill"
              defaultValue={selectedSkill}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{contractorsDictionary.filters.anySkill}</option>
              {skillOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="contractor-area" className="text-sm font-medium text-foreground">
              {contractorsDictionary.filters.serviceAreaLabel}
            </label>
            <select
              id="contractor-area"
              name="area"
              defaultValue={selectedArea}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{contractorsDictionary.filters.anyServiceArea}</option>
              {serviceAreaOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>{countLabel}</div>
          <div className="flex flex-wrap gap-3">
            {showReset ? (
              <Link
                href={`/${locale}/contractors`}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                {contractorsDictionary.filters.reset}
              </Link>
            ) : null}
            <button type="submit" className={cn(buttonVariants({ size: "sm" }))}>
              {contractorsDictionary.filters.submit}
            </button>
          </div>
        </div>
      </form>

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {contractorsDictionary.directory.error}
        </div>
      ) : null}

      {contractors.length > 0 ? (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {contractors.map((contractor) => (
            <li key={contractor.id}>
              <ContractorCard
                locale={locale}
                contractor={contractor}
                dictionary={contractorsDictionary}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-border bg-muted/30 p-10 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            {contractorsDictionary.directory.emptyTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {contractorsDictionary.directory.emptyDescription}
          </p>
        </div>
      )}
    </section>
  );
}
