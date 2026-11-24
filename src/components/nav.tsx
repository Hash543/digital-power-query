"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LangToggle, T } from "./lang";

export const calcLinks = [
  { href: "/calc/pmbus", en: "PMBus formats", zh: "PMBus 格式" },
  { href: "/calc/qformat", en: "Q format", zh: "Q 格式" },
  { href: "/calc/resolution", en: "PWM & ADC", zh: "PWM 與 ADC" },
  { href: "/calc/compensator", en: "Compensator", zh: "補償器" },
];

export function Nav() {
  const path = usePathname();
  const links = [{ href: "/terms", en: "Terms", zh: "名詞" }, ...calcLinks];
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Digital Power <span className="text-accent">Query</span>
        </Link>
        <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={path.startsWith(l.href) ? "font-medium text-accent" : "text-muted hover:text-foreground"}
            >
              <T en={l.en} zh={l.zh} />
            </Link>
          ))}
        </nav>
        <LangToggle />
      </div>
    </header>
  );
}
