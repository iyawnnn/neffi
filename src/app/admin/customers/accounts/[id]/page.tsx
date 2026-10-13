import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { accountDirectoryDetail } from "@/modules/accounts/directory";
import { formatDateTime } from "@/lib/format-date";
export const instant = false;
export default async function AccountPage({ params }: PageProps<"/admin/customers/accounts/[id]">) {
  await requireOwner(); await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await accountDirectoryDetail(db, id);
  if (!account) notFound();
  return <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8"><Link className="underline" href="/admin/customers?view=accounts">Neffi Accounts</Link><h1 className="break-all text-2xl font-semibold">{account.email}</h1>
    <p>Read-only Account</p><dl><dt>Role</dt><dd>{account.role}</dd><dt>Created</dt><dd>{formatDateTime(account.createdAt)}</dd><dt>Sign-in methods</dt><dd>{account.methods.join(", ")}</dd></dl>
    <section><h2 className="font-semibold">Owned cards</h2><ul>{account.cards.map((card, i) => <li key={i} className="border-b py-3">…{card.tokenSuffix} · {card.state} · {card.disabled ? "Disabled" : "Enabled"} · {card.profileName ?? "No connected profile"} {card.profileStatus}</li>)}</ul>{!account.cards.length ? <p>No owned cards.</p> : null}</section>
    <section><h2 className="font-semibold">Profiles</h2><ul>{account.profiles.map((profile, i) => <li key={i} className="border-b py-3">{profile.name ?? "Unnamed profile"} · {profile.status}</li>)}</ul>{!account.profiles.length ? <p>No profiles.</p> : null}</section>
  </main>;
}
