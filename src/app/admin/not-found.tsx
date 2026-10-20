import { SearchX } from "lucide-react";
import { adminPage, EmptyState, LinkButton } from "./ui";

export default function AdminNotFound() {
  return (
    <main className={adminPage}>
      <div className="mx-auto max-w-md py-10">
        <EmptyState icon={SearchX} title="Record not found" action={<LinkButton href="/admin">Back to dashboard</LinkButton>}>It may have been removed, or the link is incomplete.</EmptyState>
      </div>
    </main>
  );
}
