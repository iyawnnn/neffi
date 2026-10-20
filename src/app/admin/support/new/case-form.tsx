"use client";

import { useState } from "react";
import { ClipboardList, IdCard, Loader2, Plus, Search, SearchX, ShieldAlert, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/modules/search-types";
import { fieldLabel, FormPanel, FormSection, Input, label, Select, Textarea } from "../../ui";
import { describeHit } from "../../search/hits";
import { MIN_SEARCH_TERM, useRecordSearch } from "../../search/use-record-search";

// The four links a case can carry. Each maps to the form field the existing action already reads, so choosing a
// record here only fills those fields; one record per kind, and the server still checks that each one exists.
type LinkField = "orderId" | "purchaserId" | "accountId" | "cardId";
const linkKinds: Record<LinkField, { noun: string; icon: LucideIcon }> = {
  orderId: { noun: "Order", icon: ClipboardList },
  purchaserId: { noun: "Customer", icon: UserRound },
  accountId: { noun: "Neffi account", icon: Users },
  cardId: { noun: "Affected card", icon: IdCard },
};
const fieldFor = (type: SearchHit["type"]): LinkField | null => (type === "order" ? "orderId" : type === "customer" ? "purchaserId" : type === "account" ? "accountId" : type === "card" ? "cardId" : null);

export type LinkedRecord = { field: LinkField; id: string; title: string; subtitle: string };

export function CaseFields({ types, assignees, ownerId, initial }: { types: string[]; assignees: { id: string; email: string }[]; ownerId: string; initial: LinkedRecord[] }) {
  const [type, setType] = useState(types[0]);
  const [owner, setOwner] = useState(ownerId);
  const [summary, setSummary] = useState("");
  const [query, setQuery] = useState("");
  const [linked, setLinked] = useState<LinkedRecord[]>(initial);
  const term = query.trim();
  const { loading, hits, failed, done } = useRecordSearch(term);
  const choices = hits.flatMap((hit) => { const field = fieldFor(hit.type); return field ? [{ hit, field }] : []; });
  const ownerEmail = assignees.find((row) => row.id === owner)?.email ?? "Not set";

  const add = (field: LinkField, hit: SearchHit) => {
    const { title, subtitle } = describeHit(hit);
    setLinked((current) => [...current.filter((record) => record.field !== field), { field, id: hit.id, title, subtitle }]);
    setQuery("");
  };

  return (
    <>
      <div className="flex min-w-0 flex-col gap-6 lg:col-start-1">
        <FormPanel>
          <FormSection title="Case" description="What happened, in a sentence the next person can act on.">
            <label className={fieldLabel}>Type<Select name="type" value={type} onChange={(event) => setType(event.target.value)}>{types.map((value) => <option key={value} value={value}>{label(value)}</option>)}</Select></label>
            <label className={fieldLabel}>
              Summary
              <Textarea name="summary" required maxLength={500} value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-28" />
              <span className="text-label font-normal text-fg-secondary tabular-nums" aria-live="polite">{summary.length} / 500</span>
            </label>
            <p className="flex items-start gap-2.5 rounded-lg border bg-canvas px-3 py-2.5 text-meta text-fg-secondary"><ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-secondary" />Do not paste activation codes, identity documents or secrets into a case.</p>
          </FormSection>

          <FormSection title="Related records" description="Link the order, customer, account or card this case is about. One of each; links can't be changed once the case is open.">
            {linked.map((record) => <input key={record.field} type="hidden" name={record.field} value={record.id} />)}
            {linked.length ? (
              <ul className="flex flex-col gap-2" aria-label="Linked records">
                {linked.map((record) => {
                  const { icon: Icon, noun } = linkKinds[record.field];
                  return (
                    <li key={record.field} className="flex items-center gap-3 rounded-lg border bg-background py-2 pr-1.5 pl-3">
                      <Icon aria-hidden className="size-4 shrink-0 text-fg-secondary" />
                      <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-body font-medium">{record.title}</span><span className="truncate text-meta text-fg-secondary">{noun} · {record.subtitle}</span></span>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${noun.toLowerCase()} ${record.title}`} className="size-11 text-fg-secondary hover:text-destructive md:size-8" onClick={() => setLinked((current) => current.filter((item) => item.field !== record.field))}><X aria-hidden /></Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <div className="flex flex-col gap-2">
              <label className={fieldLabel} htmlFor="case-link-search">Find a record to link</label>
              <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-faint" />
                <Input id="case-link-search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} maxLength={100} autoComplete="off" placeholder="Order, customer, email or card" className="pl-9" role="combobox" aria-expanded={term.length >= MIN_SEARCH_TERM} aria-controls="case-link-results" />
              </div>
              <div id="case-link-results" aria-live="polite">
                {loading ? <p className="flex items-center gap-2 px-1 py-2 text-meta text-fg-secondary"><Loader2 aria-hidden className="size-3.5 animate-spin motion-reduce:animate-none" />Searching…</p> : null}
                {failed ? <p className="px-1 py-2 text-meta text-destructive">Search is unavailable right now. Try again in a moment.</p> : null}
                {done && !failed && !choices.length ? <p className="flex items-center gap-2 px-1 py-2 text-meta text-fg-secondary"><SearchX aria-hidden className="size-3.5" />No orders, customers, accounts or cards match “{term}”.</p> : null}
                {choices.length ? (
                  <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border bg-background">
                    {choices.map(({ hit, field }) => {
                      const { icon: Icon, noun } = linkKinds[field];
                      const { title, subtitle } = describeHit(hit);
                      const taken = linked.some((record) => record.field === field && record.id === hit.id);
                      return (
                        <li key={`${hit.type}-${hit.id}`}>
                          <button type="button" disabled={taken} onClick={() => add(field, hit)} className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left nav-interact transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
                            <Icon aria-hidden className="size-4 shrink-0 text-fg-secondary" />
                            <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-body font-medium">{title}</span><span className="truncate text-meta text-fg-secondary">{noun} · {subtitle}</span></span>
                            <span className="inline-flex shrink-0 items-center gap-1 text-meta font-medium text-action-text">{taken ? "Linked" : <><Plus aria-hidden className="size-3.5" />Link</>}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            </div>
          </FormSection>

          <FormSection title="Assignment" description="The owner who picks this case up.">
            <label className={fieldLabel}>Assigned owner<Select name="assignedToAccountId" required value={owner} onChange={(event) => setOwner(event.target.value)}>{assignees.map((row) => <option key={row.id} value={row.id}>{row.email}</option>)}</Select></label>
          </FormSection>
        </FormPanel>
      </div>

      <aside aria-label="Case summary" className="flex flex-col gap-4 max-lg:hidden rounded-panel border bg-background p-4 sm:p-5 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <h2 className="text-section">Case summary</h2>
        <dl className="flex flex-col gap-3 text-body">
          <div className="flex flex-col gap-0.5"><dt className="text-meta text-fg-secondary">Type</dt><dd className="font-medium">{label(type)}</dd></div>
          <div className="flex flex-col gap-0.5"><dt className="text-meta text-fg-secondary">Assigned owner</dt><dd className="font-medium break-all">{ownerEmail}</dd></div>
          <div className="flex flex-col gap-1 border-t pt-3"><dt className="text-meta text-fg-secondary">Linked records</dt>
            <dd className={cn("font-medium", !linked.length && "text-fg-secondary")}>{linked.length ? `${linked.length} of 4` : "None yet"}</dd>
            {linked.length ? <dd><ul className="flex flex-col gap-1 text-meta text-fg-secondary">{linked.map((record) => <li key={record.field} className="truncate">{linkKinds[record.field].noun}: {record.title}</li>)}</ul></dd> : null}
          </div>
        </dl>
        <p className="text-label text-fg-secondary">Opening the case records it in Activity. Related records can be linked once and cannot be changed afterwards.</p>
      </aside>
    </>
  );
}
