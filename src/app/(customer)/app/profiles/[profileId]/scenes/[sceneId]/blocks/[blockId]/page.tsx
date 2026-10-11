import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { blockForEditing } from "@/modules/profiles/editor";
import { BlockForm } from "../../block-forms";

export const instant = false;

export default async function EditBlockPage({ params }: PageProps<"/app/profiles/[profileId]/scenes/[sceneId]/blocks/[blockId]">) {
  const viewer = await requireAccount("/app");
  const { profileId, sceneId, blockId } = await params;
  const block = await blockForEditing(db, viewer.accountId, profileId, blockId);
  if (!block || block.sceneId !== sceneId) notFound();
  return <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-4"><h1 className="text-2xl font-semibold tracking-tight">{block.type === "form" ? "Form settings" : `Edit ${block.type[0].toUpperCase() + block.type.slice(1)}`}</h1>{block.type === "form" ? <Link href={`/app/profiles/${profileId}/scenes/${sceneId}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Back to scene</Link> : <BlockForm profileId={profileId} sceneId={sceneId} blockId={block.id} type={block.type} content={block.content} />}</div></main>;
}
