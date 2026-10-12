import { connection } from "next/server";
import { db } from "@/db";
import { resolvePublicExperience } from "@/modules/cards/resolve";
import { buildVCard, vCardFilename } from "@/modules/profiles/vcard";
import { cachedSceneView } from "../cached-view";

const PRIVATE = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

// Save contact: the same fresh card check as the page, then only what the shown Scene offers.
export async function GET(_request: Request, { params }: RouteContext<"/c/[token]/contact">) {
  await connection();
  const { token } = await params;
  const experience = await resolvePublicExperience(db, token, cachedSceneView);
  if (experience.status !== "published" || !experience.view.blocks.some(block => block.type === "contact" && block.saveContact)) {
    return new Response("Not found", { status: 404, headers: PRIVATE });
  }
  const { identity } = experience.view;
  return new Response(buildVCard(identity), {
    headers: { ...PRIVATE, "content-type": "text/vcard; charset=utf-8", "content-disposition": `attachment; filename="${vCardFilename(identity.fullName)}"`, "x-content-type-options": "nosniff" },
  });
}
