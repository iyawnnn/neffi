import type { CaseEmailKind } from "@/modules/support/email";
import { ActionForm } from "../../inventory/forms";
import { fieldLabel, Panel, Section, Textarea } from "../../ui";
import { sendCaseMessageAction } from "./actions";

export function CaseEmails({ caseId, recipient, active, failedKinds }: { caseId: string; recipient: string | null; active: boolean; failedKinds: CaseEmailKind[] }) {
  if (!recipient) return <Section title="Email"><p className="text-body text-fg-secondary">Link an Account or use a case with a requester email before sending.</p></Section>;
  function form(kind: CaseEmailKind, resend = false) {
    const title = resend ? `Resend ${kind}` : kind === "reply" ? "Send reply" : "Resolve with notice";
    return <Panel key={`${kind}-${resend}`} padded><ActionForm action={sendCaseMessageAction} submit={title} variant={kind === "reply" && !resend ? "primary" : "default"}>
      <input type="hidden" name="caseId" value={caseId} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="attemptId" value={crypto.randomUUID()} />
      {resend ? <input type="hidden" name="resend" value="on" /> : null}
      {kind !== "acknowledgement" ? <label className={fieldLabel}>{resend ? "Re-enter message (bodies are not stored)" : title}<Textarea name="body" maxLength={2000} required /></label> : null}
      <p className="text-meta text-fg-secondary">Activation codes must be given directly, never by email.</p>
    </ActionForm></Panel>;
  }
  return <Section title="Email" description={`Recipient: ${recipient}`}>
    {active || failedKinds.length ? <div className="grid items-start gap-4 md:grid-cols-2">{active ? <>{form("reply")}{form("resolution")}</> : null}{failedKinds.map(kind => form(kind, true))}</div> : null}
  </Section>;
}
