import { connection } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { PAGE_SIZE, pageWindow } from "@/modules/pagination";
import { countCases, listCases } from "@/modules/support/queries";
import { SupportView } from "./support-view";

export const instant = false;

export default async function SupportQueue({ searchParams }: Pick<PageProps<"/admin/support">, "searchParams">) {
  await requireOwner();
  await connection();
  const params = await searchParams;
  const status = z.enum(["open", "waiting_on_customer", "resolved"]).safeParse(params.status);
  const source = z.enum(["owner", "public", "account"]).safeParse(params.source);
  const filters = { status: status.success ? status.data : undefined, source: source.success ? source.data : undefined };
  const paging = pageWindow(await countCases(db, filters), params.page);
  const page = await listCases(db, { ...filters, limit: PAGE_SIZE, offset: paging.offset });
  return <SupportView filters={filters} paging={paging} cases={page.cases} />;
}
