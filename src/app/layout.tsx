import type { Metadata } from "next";
import { Outfit, Source_Sans_3 } from "next/font/google";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "LineUp",
  description:
    "Activity registration for teams and clubs — fair lists, ranks, and spots without the WhatsApp race.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${sourceSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <AnalyticsProvider />
      </body>
    </html>
  );
}
