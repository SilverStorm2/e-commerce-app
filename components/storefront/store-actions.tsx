import Link from "next/link";
import type { Route } from "next";
import type { Session } from "@supabase/supabase-js";

import { FollowStoreButton } from "@/components/storefront/follow-store-button";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/pl";

type StoreActionsProps = {
  locale: Locale;
  storeId: string;
  storeSlug: string;
  dictionary: Dictionary;
  session: Session | null;
  redirectPath: string;
};

export function StoreActions({
  locale,
  storeId,
  storeSlug,
  dictionary,
  session,
  redirectPath,
}: StoreActionsProps) {
  const loginHref = `/${locale}/login?redirect_to=${encodeURIComponent(redirectPath)}` as Route;
  const composeHref = `/${locale}/messages/new?tenant=${encodeURIComponent(storeSlug)}` as Route;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {session ? (
        <FollowStoreButton
          storeId={storeId}
          storeSlug={storeSlug}
          labels={{
            follow: dictionary.storefront.followCta,
            following: dictionary.storefront.followingCta,
            toggling: dictionary.storefront.followToggling,
            hint: dictionary.storefront.followHint,
          }}
        />
      ) : (
        <Button variant="outline" asChild>
          <Link href={loginHref}>{dictionary.storefront.followCta}</Link>
        </Button>
      )}

      {session ? (
        <Button asChild>
          <Link href={composeHref}>{dictionary.storefront.messageCta}</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link href={loginHref}>{dictionary.storefront.messageCta}</Link>
        </Button>
      )}
    </div>
  );
}
