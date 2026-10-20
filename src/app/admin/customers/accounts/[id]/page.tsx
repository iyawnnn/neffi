import { connection } from "next/server";
import { notFound } from "next/navigation";
import { IdCard, LifeBuoy, UserRound } from "lucide-react";
import { z } from "zod";
import { requireOwner } from "@/auth/access";
import { db } from "@/db";
import { accountDirectoryDetail } from "@/modules/accounts/directory";
import { formatDateTime } from "@/lib/format-date";
import { adminPage, cardTone, DetailList, EmptyPanel, label, LinkButton, Meta, PageHeader, Panel, RecordTable, Section, Status } from "../../../ui";
export const instant = false;
export default async function AccountPage({ params }: PageProps<"/admin/customers/accounts/[id]">) {
  await requireOwner(); await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await accountDirectoryDetail(db, id);
  if (!account) notFound();
  return <main data-admin-section="customers" className={adminPage}>
    <PageHeader back={{ href: "/admin/customers?view=accounts", label: "Neffi Accounts" }} title={<span className="break-all">{account.email}</span>} description="Read-only Account" actions={<LinkButton href={`/admin/support/new?accountId=${id}`} icon={LifeBuoy}>Open support case</LinkButton>} />
    <Section title="Account">
      <Panel padded><DetailList rows={[["Role", label(account.role)], ["Created", formatDateTime(account.createdAt)], ["Sign-in methods", account.methods.join(", ")]]} /></Panel>
    </Section>
    <Section title="Owned cards">
      {account.cards.length ? (
        <RecordTable
          caption="Owned cards"
          rows={account.cards.map((card, index) => ({ ...card, key: String(index) }))}
          rowKey={(card) => card.key}
          href={() => undefined}
          columns={[
            { label: "Card", cell: (card) => <><span className="font-mono font-medium">…{card.tokenSuffix}</span><Meta>{card.profileName ?? "No connected profile"}{card.profileStatus ? ` · ${card.profileStatus}` : ""}</Meta></> },
            { label: "State", cell: (card) => <Status tone={cardTone(card.state)}>{label(card.state)}</Status> },
            { label: "Access", cell: (card) => <Status tone={card.disabled ? "danger" : "neutral"}>{card.disabled ? "Disabled" : "Enabled"}</Status> },
          ]}
          mobile={(card) => ({ title: <span className="font-mono">…{card.tokenSuffix}</span>, status: <Status tone={cardTone(card.state)}>{label(card.state)}</Status>, subtitle: `${card.profileName ?? "No connected profile"}${card.profileStatus ? ` · ${card.profileStatus}` : ""}`, meta: card.disabled ? "Disabled" : "Enabled" })}
        />
      ) : <EmptyPanel icon={IdCard} title="No owned cards">Cards appear here once this Account claims one.</EmptyPanel>}
    </Section>
    <Section title="Profiles">
      {account.profiles.length ? (
        <RecordTable
          caption="Profiles"
          rows={account.profiles.map((profile, index) => ({ ...profile, key: String(index) }))}
          rowKey={(profile) => profile.key}
          href={() => undefined}
          columns={[
            { label: "Profile", cell: (profile) => <span className="font-medium">{profile.name ?? "Unnamed profile"}</span> },
            { label: "Status", cell: (profile) => label(profile.status) },
          ]}
          mobile={(profile) => ({ title: profile.name ?? "Unnamed profile", meta: label(profile.status) })}
        />
      ) : <EmptyPanel icon={UserRound} title="No profiles">This Account has not created a profile.</EmptyPanel>}
    </Section>
  </main>;
}
