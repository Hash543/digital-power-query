import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTerm, terms } from "@/lib/terms";
import { TermDetail } from "./term-detail";

export function generateStaticParams() {
  return terms.map((t) => ({ id: t.id }));
}

export async function generateMetadata({ params }: PageProps<"/terms/[id]">) {
  const t = getTerm((await params).id);
  return { title: t ? `${t.term} · Digital Power Query` : "Not found" };
}

async function Inner({ params }: { params: PageProps<"/terms/[id]">["params"] }) {
  const t = getTerm((await params).id);
  if (!t) notFound();
  return <TermDetail term={t} />;
}

export default function TermPage({ params }: PageProps<"/terms/[id]">) {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <Inner params={params} />
    </Suspense>
  );
}
