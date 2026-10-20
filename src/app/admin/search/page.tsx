import { connection } from "next/server";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { searchPage } from "@/modules/search";
import { SearchView } from "./search-view";

export const instant = false;

export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  await requireOwner(); await connection();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const { hits, window: paging } = await searchPage(db, query, params.page);
  return <SearchView {...{ query, hits, paging }} />;
}
