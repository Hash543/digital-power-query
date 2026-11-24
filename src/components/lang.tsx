"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Lang = "en" | "zh";

// Language preference lives in localStorage; pages stay statically prerendered (English) and
// switch on the client after hydration.
const KEY = "lang";
const EVENT = "lang-change";

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === "zh" ? "zh" : "en";
  } catch {
    return "en";
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useLang() {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  return { lang, setLang };
}

export function LangSync() {
  const { lang } = useLang();
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hant" : "en";
  }, [lang]);
  return null;
}

/** Inline bilingual text. */
export function T({ en, zh }: { en: React.ReactNode; zh: React.ReactNode }) {
  const { lang } = useLang();
  return <>{lang === "zh" ? zh : en}</>;
}

export function LangToggle() {
  const { lang } = useLang();
  return (
    <div className="flex overflow-hidden rounded-md border border-line text-sm" role="group" aria-label="Language">
      {(["en", "zh"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`px-2.5 py-1 ${lang === l ? "bg-accent text-white" : "hover:bg-panel"}`}
        >
          {l === "en" ? "EN" : "中文"}
        </button>
      ))}
    </div>
  );
}
