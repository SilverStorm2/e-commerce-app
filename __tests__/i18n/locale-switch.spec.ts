import pl from "@/locales/pl.json";
import en from "@/locales/en.json";

type Dictionary = typeof pl;

const REQUIRED_NAV_KEYS = ["marketplace", "stories", "contractors", "login", "signup", "admin"];
const PLACEHOLDER_KEYS = [
  "marketplace",
  "stories",
  "contractors",
  "login",
  "signup",
  "admin",
  "stores",
  "legalPrivacy",
  "legalTerms",
  "legalReturns",
];

describe("Locale dictionaries", () => {
  it("keep the same shape across locales", () => {
    expectSameStructure(en, pl);
  });

  it("provide top-level navigation parity", () => {
    expect(Object.keys(pl.navigation)).toEqual(REQUIRED_NAV_KEYS);
    expect(Object.keys(en.navigation)).toEqual(REQUIRED_NAV_KEYS);
  });

  it("expose placeholder descriptions and hints for core routes", () => {
    for (const key of PLACEHOLDER_KEYS) {
      const plPlaceholder = pl.placeholders[key as keyof Dictionary["placeholders"]];
      const enPlaceholder = en.placeholders[key as keyof Dictionary["placeholders"]];

      expect(plPlaceholder?.description).toBeTruthy();
      expect(enPlaceholder?.description).toBeTruthy();
      expect(typeof plPlaceholder?.hint).toBe("string");
      expect(typeof enPlaceholder?.hint).toBe("string");
    }
  });
});

function expectSameStructure(reference: unknown, candidate: unknown, path: string[] = []) {
  if (typeof reference !== "object" || reference === null) {
    expect(typeof candidate).toBe(typeof reference);
    return;
  }

  expect(typeof candidate).toBe("object");
  expect(candidate).not.toBeNull();

  const referenceEntries = Object.entries(reference as Record<string, unknown>);
  const candidateKeys = Object.keys(candidate as Record<string, unknown>);

  expect(candidateKeys.sort()).toEqual(referenceEntries.map(([key]) => key).sort());

  for (const [key, value] of referenceEntries) {
    expectSameStructure(value, (candidate as Record<string, unknown>)[key], [...path, key]);
  }
}
