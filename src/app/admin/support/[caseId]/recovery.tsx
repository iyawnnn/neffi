import { Input, Textarea } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format-date";
import type { getCaseDetail } from "@/modules/support/queries";
import { ActionForm } from "../../inventory/forms";
import { initiateRecoveryAction, cancelRecoveryAction, secureAccountAction, resendRecoveryNoticeAction, resendSecurityNoticeAction } from "./actions";

export function CaseRecovery({ support }: { support: NonNullable<Awaited<ReturnType<typeof getCaseDetail>>> }) {
  if (support.account?.role !== "customer") return <p>Recovery and secure actions require a linked customer Account. Owner Accounts are excluded.</p>;
  const active = support.status !== "resolved";
  const hidden = <input type="hidden" name="caseId" value={support.id} />;
  const verification = <><label className="flex flex-col gap-1">Verification note<Textarea name="verificationNote" minLength={10} maxLength={300} required /></label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="confirmed" required />I verified the requester&apos;s claim</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" name="unlinkGoogle" defaultChecked />Also remove Google sign-in</label><p className="text-sm">Do not include codes or secrets in the note.</p></>;
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Account access</h2><p>If compromise is suspected, secure the Account first. Recovery does not move Cards or Profiles.</p>
    {active ? <ActionForm action={secureAccountAction} submit="Secure account">{hidden}{verification}</ActionForm> : null}
    {support.timeline.filter(event => event.type === "security_notice_failed" && event.note?.startsWith("account_secured ")).map(event => <ActionForm key={event.id} action={resendSecurityNoticeAction} submit="Resend account secured notice">{hidden}<input type="hidden" name="eventId" value={event.id} /></ActionForm>)}
    {active && support.type === "account_recovery" ? <ActionForm action={initiateRecoveryAction} submit="Initiate recovery">{hidden}<label className="flex flex-col gap-1">New email<Input name="newEmail" type="email" maxLength={254} required /></label>{verification}<p>The address must not belong to an Account. Do not sign in with it until recovery completes.</p></ActionForm> : null}
    {(support.recoveries ?? []).map(row => <div key={row.id} className="space-y-2 rounded-lg border p-4"><p className="break-all">{row.newEmail} · {row.status} · {row.attempts} wrong attempts</p><p>Expires {formatDateTime(row.expiresAt)}</p>{row.status === "pending" && active ? <ActionForm action={cancelRecoveryAction} submit="Cancel recovery">{hidden}<input type="hidden" name="recoveryId" value={row.id} /></ActionForm> : null}<p className="text-sm">Recovery codes cannot be resent. If delivery failed, cancel and initiate a fresh recovery.</p>{(["recovery_started", "recovery_completed"] as const).filter(kind => support.timeline.some(event => event.type === "security_notice_failed" && event.note?.startsWith(`${kind} ${row.id} `))).map(kind => <ActionForm key={kind} action={resendRecoveryNoticeAction} submit={`Resend ${kind.replaceAll("_", " ")} notice`}>{hidden}<input type="hidden" name="recoveryId" value={row.id} /><input type="hidden" name="kind" value={kind} /></ActionForm>)}</div>)}
  </section>;
}
