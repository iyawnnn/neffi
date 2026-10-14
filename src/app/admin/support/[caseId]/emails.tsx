import { Textarea } from "@/components/ui/input";
import type { CaseEmailKind } from "@/modules/support/email";
import { ActionForm } from "../../inventory/forms";
import { sendCaseMessageAction } from "./actions";

export function CaseEmails({ caseId, recipient, active, failedKinds }: { caseId: string; recipient: string | null; active: boolean; failedKinds: CaseEmailKind[] }) {
  if (!recipient) return <section><h2 className="text-xl font-semibold">Email</h2><p>Link an Account or use a case with a requester email before sending.</p></section>;
  function form(kind: CaseEmailKind, resend = false) {
    const title = resend ? `Resend ${kind}` : kind === "reply" ? "Send reply" : "Resolve with notice";
    return <ActionForm key={`${kind}-${resend}`} action={sendCaseMessageAction} submit={title}>
      <input type="hidden" name="caseId" value={caseId} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="attemptId" value={crypto.randomUUID()} />
      {resend ? <input type="hidden" name="resend" value="on" /> : null}
      {kind !== "acknowledgement" ? <label className="flex flex-col gap-1">{resend ? "Re-enter message (bodies are not stored)" : title}<Textarea name="body" maxLength={2000} required /></label> : null}
      <p className="text-sm text-muted-foreground">Activation codes must be given directly, never by email.</p>
    </ActionForm>;
  }
  return <section className="space-y-4"><h2 className="text-xl font-semibold">Email</h2><p className="break-all">Recipient: {recipient}</p>{active ? <>{form("reply")}{form("resolution")}</> : null}{failedKinds.map(kind => form(kind, true))}</section>;
}
