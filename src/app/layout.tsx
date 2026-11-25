import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LangSync } from "@/components/lang";
import { Nav } from "@/components/nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Digital Power Query",
  description: "Reference and calculators for digital power: PMBus formats, Q format, PWM/ADC resolution, digital compensators.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <LangSync />
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="break-words border-t border-line px-4 py-4 text-center text-xs text-muted [overflow-wrap:anywhere]">
          Digital Power Query · API: <code>/api/terms</code>, <code>/api/calc/&#123;pmbus|qformat|resolution|compensator|topology&#125;</code>
        </footer>
      </body>
    </html>
  );
}
