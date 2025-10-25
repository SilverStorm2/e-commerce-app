import Link from "next/link";

import type { ContractorDirectoryProfile } from "@/app/[locale]/contractors/queries";
import type { Locale } from "@/lib/i18n/config";
import type dictionaryPl from "@/locales/pl.json";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/storefront";

type ContractorsDictionary = typeof dictionaryPl.contractors;

type ContractorCardProps = {
  locale: Locale;
  contractor: ContractorDirectoryProfile;
  dictionary: ContractorsDictionary;
};

function resolveProfileHref(contractor: ContractorDirectoryProfile, locale: Locale) {
  const slug = contractor.slug?.trim();
  const identifier = slug && slug.length > 0 ? slug : contractor.id;
  return `/${locale}/contractors/${identifier}`;
}

function getLabel(labels: Record<string, string> | undefined, value: string): string {
  if (!labels) {
    return value;
  }

  return labels[value] ?? value;
}

function formatLanguages(
  languages: string[],
  languageLabels: Record<string, string> | undefined,
): string {
  if (languages.length === 0) {
    return "";
  }

  return languages.map((code) => getLabel(languageLabels, code) ?? code.toUpperCase()).join(", ");
}

export function ContractorCard({ locale, contractor, dictionary }: ContractorCardProps) {
  const { filters, card, badges, languageLabels } = dictionary;

  const hourlyRate =
    contractor.hourly_rate && card.hourlyFrom
      ? card.hourlyFrom.replace(
          "{price}",
          formatPrice(contractor.hourly_rate, locale, contractor.currency_code),
        )
      : null;

  const availabilityLabel =
    contractor.availability && card.availabilityLabel
      ? `${card.availabilityLabel}: ${contractor.availability}`
      : (contractor.availability ?? null);

  const skillsToDisplay = contractor.skills.slice(0, 4);
  const serviceAreasToDisplay = contractor.service_areas.slice(0, 3);
  const languagesText = formatLanguages(contractor.languages, languageLabels);

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{contractor.display_name}</h3>
          {contractor.headline ? (
            <p className="mt-1 text-sm text-muted-foreground">{contractor.headline}</p>
          ) : null}
        </div>
        {contractor.featured && badges?.featured ? (
          <Badge variant="secondary" className="border-primary/40 bg-primary/10 text-primary">
            {badges.featured}
          </Badge>
        ) : null}
      </div>

      {contractor.short_bio ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground line-clamp-4">
          {contractor.short_bio}
        </p>
      ) : null}

      <dl className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
        {hourlyRate ? (
          <div>
            <dt className="sr-only">{card.hourlyLabel ?? "Hourly rate"}</dt>
            <dd>{hourlyRate}</dd>
          </div>
        ) : null}
        {availabilityLabel ? (
          <div>
            <dt className="sr-only">{card.availabilityLabel ?? "Availability"}</dt>
            <dd>{availabilityLabel}</dd>
          </div>
        ) : null}
        {languagesText ? (
          <div>
            <dt className="sr-only">{card.languagesHeading}</dt>
            <dd>
              <span className="font-medium text-foreground">{card.languagesHeading}: </span>
              {languagesText}
            </dd>
          </div>
        ) : null}
      </dl>

      {skillsToDisplay.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {card.skillsHeading}
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {skillsToDisplay.map((skill) => (
              <Badge key={skill} variant="outline" className="border-muted text-xs font-medium">
                {getLabel(filters.skills, skill)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {serviceAreasToDisplay.length > 0 ? (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {card.serviceAreasHeading}
          </h4>
          <p className="mt-2 text-sm text-muted-foreground">
            {serviceAreasToDisplay.map((area) => getLabel(filters.serviceAreas, area)).join(" • ")}
          </p>
        </div>
      ) : null}

      <div className="mt-auto pt-6">
        <Link
          href={resolveProfileHref(contractor, locale)}
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          {card.viewProfile}
        </Link>
      </div>
    </article>
  );
}
