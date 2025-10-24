/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  i18n: {
    defaultLocale: "pl",
    locales: ["pl", "en"],
  },
};

module.exports = nextConfig;
