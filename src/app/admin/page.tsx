import { requireOwner } from "@/auth/access";
import { signOutAction } from "@/auth/actions";
import { Button } from "@/components/ui/button";

export const instant = false;

export default async function AdminHome() {
  const viewer = await requireOwner();
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Neffi Admin</h1>
      <p className="break-all text-sm text-muted-foreground">Owner area · {viewer.email}</p>
      <form action={signOutAction}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </main>
  );
}
