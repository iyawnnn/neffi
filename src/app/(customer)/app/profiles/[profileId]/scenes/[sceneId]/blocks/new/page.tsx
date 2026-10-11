import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { blockType } from "@/db/schema/enums";
import { sceneForEditing } from "@/modules/profiles/editor";
import { BlockForm } from "../../block-forms";

export const instant = false;

export default async function NewBlockPage({ params, searchParams }: PageProps<"/app/profiles/[profileId]/scenes/[sceneId]/blocks/new">) {
  const viewer = await requireAccount("/app");
  const [{ profileId, sceneId }, query] = await Promise.all([params, searchParams]);
  const type = z.enum(blockType.enumValues).safeParse(Array.isArray(query.type) ? query.type[0] : query.type);
  if (!type.success || !await sceneForEditing(db, viewer.accountId, profileId, sceneId)) notFound();
  return <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-4"><h1 className="text-2xl font-semibold tracking-tight">Add {type.data[0].toUpperCase() + type.data.slice(1)}</h1><BlockForm profileId={profileId} sceneId={sceneId} type={type.data} /></div></main>;
}
