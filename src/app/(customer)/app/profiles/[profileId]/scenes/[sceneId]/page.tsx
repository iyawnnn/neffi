import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { db } from "@/db";
import { blockType } from "@/db/schema/enums";
import { sceneForEditing } from "@/modules/profiles/editor";
import { BlockControls, DeleteSceneForm, RenameSceneForm } from "./block-forms";

export const instant = false;

export default async function ScenePage({ params }: PageProps<"/app/profiles/[profileId]/scenes/[sceneId]">) {
  const viewer = await requireAccount("/app");
  const { profileId, sceneId } = await params;
  const edit = await sceneForEditing(db, viewer.accountId, profileId, sceneId);
  if (!edit) notFound();
  const present = new Set(edit.blocks.map(block => block.type));
  const types = [...blockType.enumValues].sort((a, b) => Number(present.has(a)) - Number(present.has(b)));
  const label = (type: string) => type[0].toUpperCase() + type.slice(1);
  return (
    <main className="flex flex-1 flex-col items-center gap-6 px-4 py-10"><div className="flex w-full max-w-sm flex-col gap-6">
      <h1 className="break-words text-2xl font-semibold tracking-tight">{edit.scene.name}</h1>
      <RenameSceneForm profileId={profileId} sceneId={sceneId} name={edit.scene.name} />
      <ul className="flex flex-col gap-4">{edit.blocks.map((block, index) => <li key={block.id} className="flex flex-col gap-3 rounded-lg border p-4"><h2 className="font-medium">{label(block.type)}</h2><p className="break-words text-sm">{block.summary}</p><BlockControls profileId={profileId} sceneId={sceneId} blockId={block.id} visible={block.visible} first={index === 0} last={index === edit.blocks.length - 1} /><Link href={`/app/profiles/${profileId}/scenes/${sceneId}/blocks/${block.id}`} className="inline-flex min-h-11 items-center underline underline-offset-4">Edit</Link></li>)}</ul>
      <section className="flex flex-col gap-2"><h2 className="font-medium">Add to this scene</h2>{types.map(type => <Link key={type} href={`/app/profiles/${profileId}/scenes/${sceneId}/blocks/new?type=${type}`} className="inline-flex min-h-11 items-center rounded-lg border px-3">Add {label(type)}</Link>)}</section>
      {edit.scene.isDefault ? null : <section className="border-t pt-6"><DeleteSceneForm profileId={profileId} sceneId={sceneId} /></section>}
    </div></main>
  );
}
