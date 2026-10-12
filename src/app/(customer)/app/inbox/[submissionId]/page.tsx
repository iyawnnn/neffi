import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { formatDateTime } from "@/lib/format-date";
import { openSubmission } from "@/modules/forms/submissions";
import { deleteSubmissionAction } from "../actions";

export const instant = false;

export default async function MessagePage({ params }: PageProps<"/app/inbox/[submissionId]">) {
  const viewer = await requireAccount("/app");
  const { submissionId } = await params;
  const message = await openSubmission(db, { accountId: viewer.accountId, submissionId });
  if (!message) notFound();
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{message.formTitle}</h1>
        <p className="text-sm text-muted-foreground">{message.profileName ?? "Untitled profile"} · {formatDateTime(message.createdAt)}</p>
        <dl className="flex flex-col gap-4">{message.answers.map((answer, index) => <div key={index}><dt className="text-sm font-medium">{answer.label}</dt><dd className="whitespace-pre-wrap break-words text-sm">{answer.value}</dd></div>)}</dl>
        {message.replyEmail ? <Link href={`mailto:${message.replyEmail}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Reply by email</Link> : null}
        <form action={async data => { "use server"; await deleteSubmissionAction(undefined, data); }} className="flex flex-col gap-3 border-t pt-4">
          <input type="hidden" name="submissionId" value={message.id} />
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="confirm" required />I understand this deletes this message</label>
          <Button type="submit" size="touch" variant="destructive">Delete message</Button>
        </form>
      </div>
    </main>
  );
}
