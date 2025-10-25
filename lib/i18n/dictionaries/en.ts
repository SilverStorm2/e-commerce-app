import dictionary from "@/locales/en.json";
import type { Dictionary as BaseDictionary } from "./pl";

const typedDictionary = dictionary satisfies BaseDictionary;

export type Dictionary = typeof typedDictionary;

export default typedDictionary;
