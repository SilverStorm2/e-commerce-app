const dictionary = {
  meta: {
    title: "e-commerce – Community marketplace",
    description:
      "A community-first multi-vendor marketplace with independent storefronts, conversations, and EU-compliant checkout.",
  },
  hero: {
    badge: "Community marketplace",
    title: "Discover independent sellers and shop together",
    subtitle:
      "One payment, sub-orders per seller, bilingual support, and compliant fulfilment tailored for Poland and the EU.",
    cta: "Start shopping",
  },
  navigation: {
    marketplace: "Marketplace",
    stories: "Store updates",
    contractors: "Hire experts",
    login: "Sign in",
    signup: "Join now",
    admin: "Seller admin",
  },
  pageTitles: {
    stores: "Stores",
    legalPrivacy: "Privacy policy",
    legalTerms: "Terms of service",
    legalReturns: "Returns & complaints",
  },
  placeholders: {
    marketplace: {
      description:
        "Browse the curated catalog across sellers and filter by categories, price, and availability.",
    },
    stories: {
      description: "Follow store updates and community highlights to stay in sync with new drops.",
    },
    contractors: {
      description: "Discover specialists open to collaborations that help stores grow faster.",
    },
    login: {
      description: "Access orders, messages, and moderation tools after a secure sign-in flow.",
    },
    signup: {
      description: "Register as a buyer or seller and become part of the e-commerce community.",
    },
    admin: {
      description:
        "Manage catalog, orders, team members, and buyer conversations from one console.",
    },
    stores: {
      description: "Meet independent stores, their product lines, and the teams behind them.",
    },
    legalPrivacy: {
      description: "Understand how we process personal data under GDPR and local regulations.",
    },
    legalTerms: {
      description: "Review the platform terms, seller responsibilities, and buyer rights.",
    },
    legalReturns: {
      description: "Learn about returns and complaint procedures aligned with EU directives.",
    },
  },
  footer: {
    rights: "© e-commerce {year}. All rights reserved.",
  },
  localeSwitcher: {
    label: "Change language",
    polish: "Polski",
    english: "English",
  },
} as const;

export type Dictionary = typeof dictionary;

export default dictionary;
