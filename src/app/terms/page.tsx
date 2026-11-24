import { Suspense } from "react";
import { TermList } from "./term-list";

async function Inner({ searchParams }: { searchParams: PageProps<"/terms">["searchParams"] }) {
  const { q, category } = await searchParams;
  return <TermList initialQuery={typeof q === "string" ? q : ""} initialCategory={typeof category === "string" ? category : ""} />;
}

export default function TermsPage({ searchParams }: PageProps<"/terms">) {
  return (
    <Suspense fallback={<TermList initialQuery="" initialCategory="" />}>
      <Inner searchParams={searchParams} />
    </Suspense>
  );
}
