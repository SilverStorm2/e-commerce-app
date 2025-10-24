import { render, screen } from "@testing-library/react";

import { LocaleProvider } from "@/components/layout/locale-provider";
import { HomeLanding } from "@/components/home/home-landing";
import plDictionary from "@/lib/i18n/dictionaries/pl";
import enDictionary from "@/lib/i18n/dictionaries/en";

describe("Home Landing", () => {
  it("renders the Polish hero content", () => {
    render(
      <LocaleProvider locale="pl" dictionary={plDictionary}>
        <HomeLanding />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: plDictionary.hero.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(plDictionary.hero.subtitle, { exact: false }),
    ).toBeInTheDocument();
  });

  it("renders the English hero content", () => {
    render(
      <LocaleProvider locale="en" dictionary={enDictionary}>
        <HomeLanding />
      </LocaleProvider>,
    );

    expect(
      screen.getByRole("heading", {
        name: enDictionary.hero.title,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(enDictionary.hero.subtitle, { exact: false }),
    ).toBeInTheDocument();
  });
});
