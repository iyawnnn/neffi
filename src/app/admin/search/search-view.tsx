import Link from "next/link";
import { ArrowRight, Search, SearchX } from "lucide-react";
import type { searchPage } from "@/modules/search";
import type { SearchType, SearchHit } from "@/modules/search-types";
import { adminPage, EmptyPanel, Input, pageHref, PageHeader, Pagination, Panel } from "../ui";
import { describeHit, HitIcon, hitHref, hitKey } from "./hits";

const heading: Record<SearchType, string> = { order: "Orders", tracking: "Tracking numbers", customer: "Customers", account: "Neffi accounts", card: "Cards", support: "Support cases" };

export function SearchView({ query, hits, paging, basePath = "/admin/search", recordHref = hitHref }: {
  query: string; hits: Awaited<ReturnType<typeof searchPage>>["hits"];
  paging: Awaited<ReturnType<typeof searchPage>>["window"];
  basePath?: string; recordHref?: (hit: SearchHit) => string;
}) {
  const tooShort = query.length > 0 && query.length < 2;
  // Hits arrive grouped by type, so a new heading starts wherever the type changes.
  const sections: { type: SearchType; rows: typeof hits }[] = [];
  for (const hit of hits) {
    const last = sections.at(-1);
    if (last?.type === hit.type) last.rows.push(hit); else sections.push({ type: hit.type, rows: [hit] });
  }

  return <main className={adminPage}>
    <PageHeader title="Search" description="Orders, customers, cards, support cases and tracking numbers." />
    <form action={basePath} role="search" className="relative">
      <label className="sr-only" htmlFor="search-page-q">Search orders, customers, cards and support</label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-faint" />
      <Input id="search-page-q" name="q" maxLength={100} defaultValue={query} placeholder="Order number, name, email, card ending, case or tracking" className="pl-9" />
      <button type="submit" className="sr-only">Search</button>
    </form>
    {query && hits.length ? (
      <div className="flex flex-col gap-6 lg:gap-8">
        {sections.map((section) => (
          <section key={section.type} aria-labelledby={`hits-${section.type}`} className="flex flex-col gap-3">
            <h2 id={`hits-${section.type}`} className="text-section">{heading[section.type]}</h2>
            <Panel>
              <ul className="divide-y">
                {section.rows.map((hit) => {
                  const { title, subtitle, status } = describeHit(hit);
                  return (
                    <li key={hitKey(hit)}>
                      <Link href={recordHref(hit)} className="group flex min-h-16 items-center gap-3 px-4 py-3 nav-interact transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:px-5">
                        <HitIcon type={hit.type} className="size-4 shrink-0 text-fg-secondary" />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="line-clamp-2 break-words text-body font-medium">{title}</span>
                          <span className="break-words text-meta text-fg-secondary">{subtitle}{status ? ` · ${status}` : ""}</span>
                          <span className="text-label text-fg-faint">Matched {hit.matched.toLowerCase()}</span>
                        </span>
                        <ArrowRight aria-hidden className="size-3.5 shrink-0 nav-interact nav-arrow" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </section>
        ))}
        <Pagination noun="results" paging={paging} hrefFor={pageHref(basePath, { q: query })} />
      </div>
    ) : null}
    {query && !hits.length ? <EmptyPanel icon={SearchX} title={tooShort ? "Keep typing" : `No results for “${query}”`}>{tooShort ? "Search needs at least two characters." : "Check the spelling, or try an order number, an email, a phone number or the last characters of a card."}</EmptyPanel> : null}
    {!query ? <EmptyPanel icon={Search} title="Search Neffi">Type a name, email, order number, card ending, case or tracking number. Press Ctrl K from anywhere in the admin to search without leaving the page.</EmptyPanel> : null}
  </main>;
}
