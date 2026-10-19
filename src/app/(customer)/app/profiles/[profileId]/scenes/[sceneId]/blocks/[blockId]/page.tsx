import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { LinkKindIcon } from "@/components/social-icons";
import { db } from "@/db";
import { LINK_KIND_LABELS, type LinkKind } from "@/modules/profiles/block-options";
import { blockForEditing } from "@/modules/profiles/editor";
import { BlockForm } from "../../block-forms";
import { BLOCK_META, BlockTile } from "../../block-meta";
import { BlockPage } from "../../block-page";
import { FormEditor } from "../../form-editor";

export const instant = false;

export default async function EditBlockPage({ params }: PageProps<"/app/profiles/[profileId]/scenes/[sceneId]/blocks/[blockId]">) {
  const viewer = await requireAccount("/app");
  const { profileId, sceneId, blockId } = await params;
  const block = await blockForEditing(db, viewer.accountId, profileId, blockId);
  if (!block || block.sceneId !== sceneId) notFound();
  if (block.type === "form" && !block.form) notFound();
  const back = `/app/profiles/${profileId}/scenes/${sceneId}`;
  const kind = block.type === "link" ? block.content.kind as LinkKind : null;
  const meta = BLOCK_META[block.type];
  return (
    <BlockPage backHref={back} icon={kind ? <LinkKindIcon kind={kind} /> : <BlockTile icon={meta.icon} />}
      title={block.type === "form" ? "Edit contact form" : `Edit ${kind ? LINK_KIND_LABELS[kind] : meta.label.toLowerCase()}`} description={meta.description}>
      {block.type === "form" ? <FormEditor profileId={profileId} sceneId={sceneId} blockId={block.id} form={block.form!} /> : <BlockForm profileId={profileId} sceneId={sceneId} blockId={block.id} type={block.type} content={block.content} cancelHref={back} />}
    </BlockPage>
  );
}
