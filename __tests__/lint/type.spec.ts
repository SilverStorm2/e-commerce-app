import { describe, expectTypeOf, it } from "vitest";

describe("TypeScript configuration", () => {
  it("infers supported locales as a narrow union", () => {
    const supportedLocales = ["pl", "en"] as const;
    type SupportedLocale = (typeof supportedLocales)[number];

    expectTypeOf<SupportedLocale>().toEqualTypeOf<"pl" | "en">();
  });

  it("preserves readonly tuple semantics", () => {
    type ResultTuple = readonly ["pending", number];
    const result: ResultTuple = ["pending", 200] as const;

    expectTypeOf(result).toEqualTypeOf<ResultTuple>();
  });
});
