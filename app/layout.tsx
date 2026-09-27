import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Manrope, Oswald } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const display = Oswald({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500"], variable: "--f-display" });
const serif = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--f-serif",
});
const sans = Manrope({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--f-sans" });

export const metadata: Metadata = {
  title: "WikiSeed — Where small languages grow",
  description:
    "Bounties for Wikipedia articles in under-served languages, judged by GenLayer's AI validators and paid on-chain.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#2C2824" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${sans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
