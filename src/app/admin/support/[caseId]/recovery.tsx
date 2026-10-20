import { formatDateTime } from "@/lib/format-date";
import type { getCaseDetail } from "@/modules/support/queries";
import { ActionForm } from "../../inventory/forms";
import { checkLabel, fieldLabel, Input, label, Panel, recoveryTone, Section, Status, Textarea } from "../../ui";
import { initiateRecoveryAction, cancelRecoveryAction, secureAccountAction, resendRecoveryNoticeAction, resendSecurityNoticeAction } from "./actions";

export function CaseRecovery({ support }: { support: NonNullable<Awaited<ReturnType<typeof getCaseDetail>>> }) {
  if (support.account?.role !== "customer") return <Section title="Account access"><p className="text-body text-fg-secondary">Recovery and secure actions require a linked customer Account. Owner Accounts are excluded.</p></Section>;
  const active = support.status !== "resolved";
  const hidden = <input type="hidden" name="caseId" value={support.id} />;
  const verification = <><label className={fieldLabel}>Verification note<Textarea name="verificationNote" minLength={10} maxLength={300} required /></label><label className={checkLabel}><input type="checkbox" name="unlinkGoogle" defaultChecked />Also remove Google sign-in</label><p className="text-meta text-fg-secondary">Do not include codes or secrets in the note.</p></>;
  return <Section title="Account access" description="If compromise is suspected, secure the Account first. Recovery does not move Cards or Profiles.">
    {active ? <Panel padded><ActionForm action={secureAccountAction} submit="Secure account" confirm={{ field: "confirmed", title: "Secure this account?", description: "Every device is signed out right away, and the customer must sign in again with an email code. Use this when compromise is suspected, and only after you have verified the requester's claim." }}>{hidden}{verification}</ActionForm></Panel> : null}
    {support.timeline.filter(event => event.type === "security_notice_failed" && event.note?.startsWith("account_secured ")).map(event => <Panel key={event.id} padded><ActionForm action={resendSecurityNoticeAction} submit="Resend account secured notice">{hidden}<input type="hidden" name="eventId" value={event.id} /></ActionForm></Panel>)}
    {active && support.type === "account_recovery" ? <Panel padded><ActionForm action={initiateRecoveryAction} submit="Initiate recovery" confirm={{ field: "confirmed", title: "Start account recovery?", description: "The old address is notified, and a recovery code goes to the new address. The customer should not sign in with the new address until recovery completes. Continue only if you have verified the requester's claim." }}>{hidden}<label className={fieldLabel}>New email<Input name="newEmail" type="email" maxLength={254} required /></label>{verification}<p className="text-meta text-fg-secondary">The address must not belong to an Account. Do not sign in with it until recovery completes.</p></ActionForm></Panel> : null}
    {(support.recoveries ?? []).map(row => <Panel key={row.id} padded className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1"><p className="min-w-0 text-body font-medium break-all">{row.newEmail}</p><Status tone={recoveryTone(row.status)}>{label(row.status)}</Status></div>
      <p className="text-meta text-fg-secondary">{row.attempts} wrong attempts · Expires {formatDateTime(row.expiresAt)}</p>
      {row.status === "pending" && active ? <ActionForm action={cancelRecoveryAction} submit="Cancel recovery" confirm={{ title: "Cancel this recovery?", description: "The recovery code stops working. Start a fresh recovery if the customer still needs one.", confirmLabel: "Cancel recovery", dismissLabel: "Keep recovery" }}>{hidden}<input type="hidden" name="recoveryId" value={row.id} /></ActionForm> : null}
      <p className="text-meta text-fg-secondary">Recovery codes cannot be resent. If delivery failed, cancel and initiate a fresh recovery.</p>
      {(["recovery_started", "recovery_completed"] as const).filter(kind => support.timeline.some(event => event.type === "security_notice_failed" && event.note?.startsWith(`${kind} ${row.id} `))).map(kind => <ActionForm key={kind} action={resendRecoveryNoticeAction} submit={`Resend ${kind.replaceAll("_", " ")} notice`}>{hidden}<input type="hidden" name="recoveryId" value={row.id} /><input type="hidden" name="kind" value={kind} /></ActionForm>)}
    </Panel>)}
  </Section>;
}
