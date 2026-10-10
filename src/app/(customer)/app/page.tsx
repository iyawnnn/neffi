import { requireAccount } from "@/auth/access";
import { authErrorMessage } from "@/auth/messages";
import { getLinkedMethods } from "@/auth/methods";
import { AccountActions } from "./account-actions";

export const instant = false;

export default async function CustomerHome({ searchParams }: PageProps<"/app">) {
  const viewer = await requireAccount("/app");
  const [methods, params] = await Promise.all([getLinkedMethods(), searchParams]);
  const error = authErrorMessage(Array.isArray(params.error) ? params.error[0] : params.error);

  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Your Neffi</h1>
      {error ? (
        <p role="alert" className="max-w-sm rounded-lg bg-muted px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      <section className="flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4">
        <h2 className="text-sm font-medium">Signed in as</h2>
        <p className="break-all">{viewer.email}</p>
        <h2 className="mt-2 text-sm font-medium">Sign-in methods</h2>
        <ul className="text-sm text-muted-foreground">
          <li>Email code</li>
          {methods.google ? <li>Google</li> : null}
        </ul>
      </section>
      <AccountActions googleLinked={methods.google} />
      <p className="max-w-sm text-center text-sm text-muted-foreground">Your cards and profiles will appear here.</p>
    </main>
  );
}
