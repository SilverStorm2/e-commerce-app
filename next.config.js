/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let remotePatterns = [];

if (supabaseUrl) {
  try {
    const { hostname } = new URL(supabaseUrl);
    remotePatterns = [
      {
        protocol: "https",
        hostname,
        pathname: "/storage/v1/object/public/**",
      },
    ];
  } catch {
    // Ignore invalid URL and fall back to empty patterns.
  }
}

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns,
  },
};

module.exports = nextConfig;
