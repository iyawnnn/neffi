import Link from "next/link";

// The same words for every reason a card shows nothing, so the page never reveals whether a link exists or why it is off.
export function Unavailable({ manageHref }: { manageHref?: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-[#F2F0EA] px-5 py-16 text-center text-[#0C0C0D]">
      <h1 className="text-2xl font-medium tracking-tight">This Neffi isn’t available right now</h1>
      <p className="max-w-sm text-[#74736F]">If you expected to see someone’s details here, ask them to share their link again.</p>
      {manageHref ? (
        <>
          <p className="text-sm text-[#74736F]">Only you can see this.</p>
          <Link href={manageHref} className="inline-flex min-h-11 items-center rounded-lg bg-[#0C0C0D] px-4 font-medium text-[#F2F0EA]">Manage this card</Link>
        </>
      ) : null}
    </main>
  );
}
