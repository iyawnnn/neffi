import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/auth/access";
import { LinkKindIcon } from "@/components/social-icons";
import { db } from "@/db";
import { blockType } from "@/db/schema/enums";
import { LINK_KINDS, LINK_KIND_LABELS } from "@/modules/profiles/block-options";
import { sceneForEditing } from "@/modules/profiles/editor";
import { BlockForm } from "../../block-forms";
import { BLOCK_META, BlockTile } from "../../block-meta";
import { BlockPage } from "../../block-page";

export const instant = false;

export default async function NewBlockPage({ params, searchParams }: PageProps<"/app/profiles/[profileId]/scenes/[sceneId]/blocks/new">) {
  const viewer = await requireAccount("/app");
  const [{ profileId, sceneId }, query] = await Promise.all([params, searchParams]);
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const type = z.enum(blockType.enumValues).safeParse(first(query.type));
  if (!type.success || !await sceneForEditing(db, viewer.accountId, profileId, sceneId)) notFound();
  const selectedKind = type.data === "link" ? z.enum(LINK_KINDS).safeParse(first(query.kind) ?? "custom") : null;
  if (selectedKind && !selectedKind.success) notFound();
  const kind = selectedKind?.success ? selectedKind.data : null;
  const meta = BLOCK_META[type.data];
  const back = `/app/profiles/${profileId}/scenes/${sceneId}`;
  return (
    <BlockPage backHref={back} icon={kind ? <LinkKindIcon kind={kind} /> : <BlockTile icon={meta.icon} />}
      title={kind && kind !== "custom" ? `Add ${LINK_KIND_LABELS[kind]}` : `Add ${meta.label.toLowerCase()}`} description={kind && kind !== "custom" ? `Paste the link to your ${LINK_KIND_LABELS[kind]} page.` : meta.description}>
      <BlockForm profileId={profileId} sceneId={sceneId} type={type.data} content={kind ? { kind } : undefined} cancelHref={back} />
    </BlockPage>
  );
}
