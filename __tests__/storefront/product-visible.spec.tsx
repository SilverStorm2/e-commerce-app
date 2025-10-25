import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FollowStoreButton } from "@/components/storefront/follow-store-button";
import { formatPrice, normalizeSlug } from "@/lib/storefront";

describe("storefront helpers", () => {
  it("normalizes slugs with diacritics into URL-safe variants", () => {
    expect(normalizeSlug("Sklep Świeże Żółwie 2024")).toBe("sklep-swieze-zolwie-2024");
  });

  it("formats price amounts using locale currency rules", () => {
    const formattedPl = formatPrice("129.5", "pl", "PLN");
    expect(formattedPl).toMatch(/\d/);
    expect(formattedPl).toMatch(/zł|PLN/i);

    const formattedEn = formatPrice("129.5", "en", "PLN");
    expect(formattedEn).toContain("PLN");
  });
});

describe("FollowStoreButton", () => {
  it("toggles follow state locally", async () => {
    render(
      <FollowStoreButton
        storeId="tenant-1"
        storeSlug="sklep-test"
        labels={{
          follow: "Follow store",
          following: "Following",
          toggling: "Updating…",
          hint: "Local toggle only",
        }}
      />,
    );

    const button = screen.getByRole("button", { name: /follow store/i });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    await waitFor(() => expect(button).toHaveTextContent("Following"));
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
