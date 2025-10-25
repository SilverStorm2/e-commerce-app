import Link from "next/link";
import { notFound } from "next/navigation";

import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import type dictionaryPl from "@/locales/pl.json";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/storefront";
import { getContractorProfileByIdentifier } from "../queries";

type ContractorDetailPageProps = {
  params: { locale: Locale; id: string };
};

type ContractorsDictionary = typeof dictionaryPl.contractors;

function resolveLabel(labels: Record<string, string> | undefined, value: string): string {
  if (!labels) {
    return value;
  }

  return labels[value] ?? value;
}

function mapValues(values: string[], labels: Record<string, string> | undefined): string[] {
  return values.map((value) => resolveLabel(labels, value));
}

export default async function ContractorDetailPage({ params }: ContractorDetailPageProps) {
  const { locale, id } = params;
  const dictionary = await getDictionary(locale);
  const contractorsDictionary = dictionary.contractors;

  const supabase = createSupabaseServerClient();
  const profile = await getContractorProfileByIdentifier(supabase, id);

  if (!profile) {
    notFound();
  }

  const hourlyRate =
    profile.hourly_rate && contractorsDictionary.detail.hourlyHeading
      ? formatPrice(profile.hourly_rate, locale, profile.currency_code)
      : null;

  const skills = mapValues(profile.skills, contractorsDictionary.filters.skills);
  const serviceAreas = mapValues(profile.service_areas, contractorsDictionary.filters.serviceAreas);
  const languages = mapValues(profile.languages, contractorsDictionary.languageLabels);

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-12 md:px-6 md:py-16">
      <Link
        href={`/${locale}/contractors`}
        className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
      >
        {contractorsDictionary.detail.backLink}
      </Link>

      <article className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {profile.display_name}
            </h1>
            {profile.headline ? (
              <p className="mt-2 text-base text-muted-foreground">{profile.headline}</p>
            ) : null}
          </div>
          {profile.featured && contractorsDictionary.badges.featured ? (
            <Badge
              variant="secondary"
              className="self-start border-primary/40 bg-primary/10 text-primary"
            >
              {contractorsDictionary.badges.featured}
            </Badge>
          ) : null}
        </div>

        {profile.short_bio ? (
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{profile.short_bio}</p>
        ) : null}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <dl className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/20 p-5 text-sm text-muted-foreground">
            {hourlyRate ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {contractorsDictionary.detail.hourlyHeading}
                </dt>
                <dd className="mt-1 text-base text-foreground">{hourlyRate}</dd>
              </div>
            ) : null}
            {profile.availability ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {contractorsDictionary.detail.availabilityHeading}
                </dt>
                <dd className="mt-1 text-foreground">{profile.availability}</dd>
              </div>
            ) : null}
            {profile.preferred_collaboration ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {contractorsDictionary.detail.preferredCollaboration}
                </dt>
                <dd className="mt-1 text-foreground">{profile.preferred_collaboration}</dd>
              </div>
            ) : null}
            {languages.length > 0 ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {contractorsDictionary.detail.languagesHeading}
                </dt>
                <dd className="mt-1 text-foreground">{languages.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
          <dl className="flex flex-col gap-4 rounded-xl border border-border/60 bg-muted/20 p-5 text-sm text-muted-foreground">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                {contractorsDictionary.detail.contactHeading}
              </dt>
              <dd className="mt-1 space-y-2 text-foreground">
                {profile.contact_email ? (
                  <p>
                    <span className="font-medium">{contractorsDictionary.detail.emailLabel}: </span>
                    <a
                      href={`mailto:${profile.contact_email}`}
                      className="text-primary hover:underline"
                    >
                      {profile.contact_email}
                    </a>
                  </p>
                ) : null}
                {profile.contact_phone ? (
                  <p>
                    <span className="font-medium">{contractorsDictionary.detail.phoneLabel}: </span>
                    <a
                      href={`tel:${profile.contact_phone}`}
                      className="text-primary hover:underline"
                    >
                      {profile.contact_phone}
                    </a>
                  </p>
                ) : null}
                {!profile.contact_email && !profile.contact_phone ? (
                  <p className="text-sm text-muted-foreground">
                    {contractorsDictionary.detail.missingContact}
                  </p>
                ) : null}
              </dd>
            </div>
            {serviceAreas.length > 0 ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {contractorsDictionary.detail.serviceAreasHeading}
                </dt>
                <dd className="mt-1 text-foreground">{serviceAreas.join(" • ")}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {skills.length > 0 ? (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {contractorsDictionary.detail.skillsHeading}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <Badge key={skill} variant="outline" className="border-muted text-xs font-medium">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {profile.bio ? (
          <div className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {contractorsDictionary.detail.aboutHeading}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
          </div>
        ) : null}
      </article>
    </section>
  );
}
