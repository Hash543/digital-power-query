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

export default async function TermPage({ params }: PageProps<"/terms/[id]">) {
  const t = getTerm((await params).id);
  if (!t) notFound();
  return <TermDetail term={t} />;
}
