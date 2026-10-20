"use client";

import { useEffect, useState } from "react";
import type { SearchHit } from "@/modules/search-types";

export const MIN_SEARCH_TERM = 2;

type Found = { term: string; hits: SearchHit[]; failed: boolean };

/**
 * Debounced owner record search against /admin/search/records. The answer is keyed by the term it was fetched for,
 * so a slow response for an older term is never shown, and nothing runs for terms that are too short.
 */
export function useRecordSearch(term: string) {
  const [found, setFound] = useState<Found | null>(null);
  useEffect(() => {
    if (term.length < MIN_SEARCH_TERM) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/admin/search/records?${new URLSearchParams({ q: term })}`, { signal: controller.signal });
        if (!response.ok) throw new Error("search failed");
        const data = (await response.json()) as { hits: SearchHit[] };
        setFound({ term, hits: data.hits, failed: false });
      } catch {
        if (!controller.signal.aborted) setFound({ term, hits: [], failed: true });
      }
    }, 220);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  const searching = term.length >= MIN_SEARCH_TERM;
  const result = searching && found?.term === term ? found : null;
  return { loading: searching && !result, hits: result?.hits ?? [], failed: Boolean(result?.failed), done: Boolean(result) };
}
