import type { Locale } from "./config";

const dictionaries = {
  pl: () => import("./dictionaries/pl"),
  en: () => import("./dictionaries/en"),
} satisfies Record<Locale, () => Promise<{ default: unknown }>>;

export type Dictionary = Awaited<
  ReturnType<(typeof dictionaries)[keyof typeof dictionaries]>
>["default"];

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  const loadDictionary = dictionaries[locale] ?? dictionaries.pl;
  const dictionaryModule = await loadDictionary();
  return dictionaryModule.default as Dictionary;
}
