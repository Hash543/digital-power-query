"use client";

import Link from "next/link";
import { T, useLang } from "@/components/lang";
import { categories, getTerm, type Term } from "@/lib/terms";

export function TermDetail({ term: t }: { term: Term }) {
  const { lang } = useLang();
  const other = lang === "zh" ? "en" : "zh";
  return (
    <article className="max-w-3xl space-y-6">
      <div>
        <Link href="/terms" className="text-sm text-accent">
          ← <T en="All terms" zh="所有名詞" />
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.term}</h1>
        <p className="text-lg text-muted">{t.zhTerm}</p>
        <span className="mt-1 inline-block rounded bg-panel px-2 py-0.5 text-xs text-muted">{categories[t.category][lang]}</span>
      </div>

      <p className="leading-relaxed">{t[lang]}</p>
      <p className="border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">{t[other]}</p>

      {t.formula && (
        <div className="rounded-md bg-panel px-4 py-3 font-mono text-sm">{t.formula}</div>
      )}

      {t.digital && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm">
          <h2 className="mb-1 font-semibold">
            <T en="Role of digital control" zh="數位控制的角色" />
          </h2>
          <p className="leading-relaxed text-muted">{t.digital[lang]}</p>
        </div>
      )}

      {(t.pros || t.cons) && (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          {[
            ["pros", t.pros, <T key="p" en="Strengths" zh="優點" />],
            ["cons", t.cons, <T key="c" en="Trade-offs" zh="缺點" />],
          ].map(([k, list, title]) =>
            list ? (
              <div key={k as string}>
                <h2 className="mb-1 font-semibold">{title as React.ReactNode}</h2>
                <ul className="list-disc space-y-0.5 pl-5 text-muted">
                  {(list as NonNullable<Term["pros"]>)[lang].map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}

      {t.category === "architecture" && (
        <Link href={`/architectures#${t.id}`} className="inline-block text-sm text-accent">
          <T en="See block diagram on the architectures page →" zh="到架構介紹頁看方塊圖 →" />
        </Link>
      )}

      {t.calc && (
        <Link href={t.calc} className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">
          <T en="Open calculator →" zh="開啟計算工具 →" />
        </Link>
      )}

      {!!t.related?.length && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            <T en="Related terms" zh="相關名詞" />
          </h2>
          <div className="flex flex-wrap gap-2">
            {t.related.map((id) => {
              const r = getTerm(id);
              return r ? (
                <Link key={id} href={`/terms/${id}`} className="rounded-full border border-line px-3 py-1 text-sm hover:border-accent">
                  {r.term}
                </Link>
              ) : null;
            })}
          </div>
        </section>
      )}

      {!!t.sources?.length && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">
            <T en="Sources" zh="參考來源" />
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {t.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
