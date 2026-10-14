import type { Metadata, Viewport } from "next";
import { Manrope, Sora } from "next/font/google";
import "./globals.css";

// Downloaded at build time and served from the site itself, so visitors never request Google Fonts.
const sora = Sora({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const title = "Beyond Borders Outsourcing | Dedicated offshore teams in the Philippines";

export const metadata: Metadata = {
  title,
  description:
    "Beyond Borders Outsourcing Services Inc. builds dedicated offshore teams in the Philippines for customer experience, hospitality, sales, and back-office support.",
  openGraph: {
    title,
    description:
      "From one dedicated professional to an entire department, BBO builds teams around your business, your systems, and your standards.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B0A2A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${manrope.variable}`}>
      {/* Browser extensions such as Grammarly add attributes to <body> before React hydrates. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
