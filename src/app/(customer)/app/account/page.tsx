import { requireAccount } from "@/auth/access";
import { authErrorMessage } from "@/auth/messages";
import { getLinkedMethods } from "@/auth/methods";
import { Button } from "@/components/ui/button";
import { AccountActions } from "./account-actions";
import { ChangeEmailForm, RemoveGoogleForm } from "./account-forms";
import { signOutEverywhereAction } from "./actions";

export const instant = false;
export default async function AccountPage({ searchParams }: PageProps<"/app/account">) {
  const viewer = await requireAccount("/app");
  const [methods, params] = await Promise.all([getLinkedMethods(), searchParams]);
  const error = authErrorMessage(typeof params.error === "string" ? params.error : undefined);
  return <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-6">
    <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
    {params.changed === "1" ? <p role="status" className="text-sm">Your sign-in email has been changed.</p> : null}
    {error ? <p role="alert" className="text-sm">{error}</p> : null}
    <section className="flex flex-col gap-2"><h2 className="font-semibold">Signed in as</h2><p className="break-all">{viewer.email}</p><h2 className="font-semibold">Sign-in methods</h2><ul className="text-sm"><li>Email code</li>{methods.google ? <li>Google</li> : null}</ul>{methods.google ? <RemoveGoogleForm /> : null}<AccountActions googleLinked={methods.google} /></section>
    <section className="flex flex-col gap-3"><h2 className="font-semibold">Change sign-in email</h2><ChangeEmailForm /></section>
    <form action={signOutEverywhereAction}><Button type="submit" size="touch" variant="outline">Sign out everywhere</Button></form>
    <section className="flex flex-col gap-2 border-t pt-4"><h2 className="font-semibold">Delete your account</h2><p className="text-sm text-muted-foreground">To delete your account, please contact Neffi support.</p></section>
  </div></main>;
}
