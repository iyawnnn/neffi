import { ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/auth/access";
import { ButtonLink } from "@/components/app-ui";
import { db } from "@/db";
import { sceneForEditing } from "@/modules/profiles/editor";
import { SceneMenu } from "./block-forms";
import { ModeEditor } from "./mode-editor";

export const instant = false;

export default async function ScenePage({ params }: PageProps<"/app/profiles/[profileId]/scenes/[sceneId]">) {
  const viewer = await requireAccount("/app");
  const { profileId, sceneId } = await params;
  const edit = await sceneForEditing(db, viewer.accountId, profileId, sceneId);
  if (!edit) notFound();
  const target = { profileId, sceneId };

  return (
    <main data-canvas className="mx-auto flex w-full max-w-[896px] flex-1 flex-col gap-6 px-4 pt-6 pb-10 md:gap-8 md:px-6 md:pt-8 md:pb-12">
      <div className="flex flex-col gap-4">
        <Link href={`/app/profiles/${profileId}`} className="-ml-2 inline-flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md px-2 text-meta font-medium text-fg-secondary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand">
          <ArrowLeft aria-hidden className="size-3.5" />Back to profile
        </Link>
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-0 max-w-full break-words text-title">{edit.scene.name}</h1>
              {edit.scene.isShown ? <span className="inline-flex items-center rounded-md bg-brand/10 px-2 py-0.5 text-label font-medium text-brand">Currently showing</span> : null}
            </div>
            <p className="mt-2 text-body text-fg-secondary">Choose what visitors see in this profile mode.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <ButtonLink href={`/app/profiles/${profileId}/preview?scene=${sceneId}`} variant="outline" className="flex-1 gap-2 sm:h-[42px] sm:flex-none">
              <Eye aria-hidden className="size-4" />Preview
            </ButtonLink>
            <SceneMenu {...target} name={edit.scene.name} canDelete={!edit.scene.isDefault} />
          </div>
        </header>
      </div>

      <ModeEditor {...target} blocks={edit.blocks} />
    </main>
  );
}
