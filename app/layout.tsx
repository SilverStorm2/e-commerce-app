import "@/styles/globals.css";
import { Inter, Playfair_Display as PlayfairDisplay } from "next/font/google";
import type { Metadata } from "next";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

const playfair = PlayfairDisplay({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "e-commerce Marketplace",
  description: "Community-centric multi-vendor marketplace for Polish and English shoppers.",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${playfair.variable} font-body antialiased bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
