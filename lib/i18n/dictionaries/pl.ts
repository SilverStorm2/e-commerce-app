const dictionary = {
  meta: {
    title: "e-commerce – Rynek wielosprzedawców",
    description:
      "Społecznościowy marketplace z polskimi i europejskimi sprzedawcami, postami i rozmowami w czasie rzeczywistym.",
  },
  hero: {
    badge: "Marketplace społecznościowy",
    title: "Odkrywaj niezależne sklepy i twórz wspólnotę kupujących",
    subtitle:
      "Jedna płatność, zamówienia od wielu sprzedawców, dwujęzyczne wsparcie i bezpieczna realizacja zgodna z RODO.",
    cta: "Zacznij zakupy",
  },
  navigation: {
    marketplace: "Marketplace",
    stories: "Aktualności sklepów",
    contractors: "Współpraca",
    login: "Zaloguj się",
    signup: "Dołącz teraz",
  },
  pageTitles: {
    stores: "Sklepy",
    legalPrivacy: "Polityka prywatności",
    legalTerms: "Regulamin",
    legalReturns: "Zwroty i reklamacje",
  },
  placeholders: {
    marketplace: {
      description:
        "Przeglądaj katalog produktów z wielu sklepów i filtruj według kategorii, cen oraz dostępności.",
    },
    stories: {
      description:
        "Czytaj aktualizacje i posty od sprzedawców, aby być na bieżąco z nowymi kolekcjami.",
    },
    contractors: {
      description:
        "Odkryj specjalistów i wykonawców otwartych na współpracę przy rozwoju Twojego sklepu.",
    },
    login: {
      description:
        "Uzyskaj dostęp do panelu sprzedawcy, zamówień i wiadomości po bezpiecznym zalogowaniu.",
    },
    signup: {
      description: "Załóż konto jako kupujący lub sprzedawca i dołącz do społeczności e-commerce.",
    },
    stores: {
      description: "Poznaj niezależne sklepy, ich kategorie oraz członków zespołu.",
    },
    legalPrivacy: {
      description: "Dowiedz się, w jaki sposób przetwarzamy dane osobowe zgodnie z RODO.",
    },
    legalTerms: {
      description:
        "Zapoznaj się z regulaminem platformy, obowiązkami sprzedawców i prawami kupujących.",
    },
    legalReturns: {
      description:
        "Sprawdź zasady zwrotów i procedury reklamacyjne zgodne z prawem Unii Europejskiej.",
    },
  },
  footer: {
    rights: "© e-commerce {year}. Wszelkie prawa zastrzeżone.",
  },
  localeSwitcher: {
    label: "Zmień język",
    polish: "Polski",
    english: "English",
  },
} as const;

export type Dictionary = typeof dictionary;

export default dictionary;
