"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { T, useLang } from "@/components/lang";
import { PageHeader, Select, TextInput } from "@/components/ui";
import { categories, searchTerms, type Category } from "@/lib/terms";

export function TermList({ initialQuery, initialCategory }: { initialQuery: string; initialCategory: string }) {
  const { lang } = useLang();
  const [q, setQ] = useState(initialQuery);
  const [cat, setCat] = useState(initialCategory);
  const list = useMemo(() => searchTerms(q, cat || undefined), [q, cat]);

  return (
    <div>
      <PageHeader
        title={<T en="Terms reference" zh="名詞查詢" />}
        intro={<T en="Search in English or Chinese. Each entry lists formulas, related terms and sources." zh="可用中文或英文搜尋。每個條目附有公式、相關名詞與參考來源。" />}
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <TextInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "zh" ? "搜尋…" : "Search…"}
          aria-label="Search"
          className="max-w-sm font-sans"
          autoFocus
        />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="max-w-48" aria-label="Category">
          <option value="">{lang === "zh" ? "全部分類" : "All categories"}</option>
          {Object.entries(categories).map(([k, v]) => (
            <option key={k} value={k}>
              {v[lang]}
            </option>
          ))}
        </Select>
        <span className="self-center text-sm text-muted">
          {list.length} <T en="results" zh="筆結果" />
        </span>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((t) => (
          <li key={t.id}>
            <Link href={`/terms/${t.id}`} className="block h-full rounded-lg border border-line bg-surface p-4 hover:border-accent">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold">
                  {t.term} <span className="font-normal text-muted">· {t.zhTerm}</span>
                </h2>
                <span className="shrink-0 rounded bg-panel px-2 py-0.5 text-xs text-muted">
                  {categories[t.category as Category][lang]}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-3 text-sm text-muted">{t[lang]}</p>
            </Link>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className="text-sm text-muted">
          <T en="No matching terms." zh="找不到符合的名詞。" />
        </p>
      )}
    </div>
  );
}
