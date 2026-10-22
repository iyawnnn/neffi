"use client";

import { useRef, useState } from "react";
import { AppearanceForm } from "@/app/(customer)/app/profiles/[profileId]/appearance/appearance-form";
import type { CoverEditorActions, CoverEditorImage } from "@/app/(customer)/app/profiles/[profileId]/cover-editor";
import type { CoverCrop } from "@/modules/profiles/cover";
import type { SceneView } from "@/modules/profiles/scene-view";

function readImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be read."));
    image.src = src;
  });
}

// This adapter never signs uploads or calls a database; edits last only until reload.
export function AppearanceReview({ initialView }: { initialView: SceneView }) {
  const [view, setView] = useState(initialView);
  const [cover, setCover] = useState<CoverEditorImage | null>(initialView.appearance.cover ? {
    assetId: "sample-cover", src: "/dev/profile-cover.svg", width: 1200, height: 400, crop: { x: 0, y: 0, width: 1200 },
  } : null);
  const assets = useRef(new Map<string, Omit<CoverEditorImage, "crop">>());
  const active = useRef(cover);

  async function save(image: Omit<CoverEditorImage, "crop">, crop: CoverCrop) {
    const source = await readImage(image.src);
    const canvas = document.createElement("canvas");
    canvas.width = crop.width; canvas.height = Math.round(crop.width / 3);
    canvas.getContext("2d")!.drawImage(source, crop.x, crop.y, crop.width, canvas.height, 0, 0, canvas.width, canvas.height);
    const src = canvas.toDataURL("image/jpeg", 0.9);
    const next = { ...image, crop };
    active.current = next; setCover(next);
    setView(previous => ({ ...previous, appearance: { ...previous.appearance, cover: { src, srcSet: `${src} ${crop.width}w` } } }));
  }
  const actions: CoverEditorActions = {
    start: async () => ({ ticket: { url: "synthetic", fields: { public_id: crypto.randomUUID() } } }),
    upload: async (ticket, file) => {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
      });
      const image = await readImage(data);
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL("image/jpeg", 0.9);
      const assetId = ticket.fields.public_id;
      assets.current.set(assetId, { assetId, src, width: canvas.width, height: canvas.height });
      return { public_id: assetId, secure_url: src, width: canvas.width, height: canvas.height };
    },
    confirm: async (_id, assetId, crop) => { await save(assets.current.get(assetId)!, crop); return { ok: true }; },
    crop: async (_id, crop) => { await save(active.current!, crop); return {}; },
    remove: async () => {
      active.current = null; setCover(null);
      setView(previous => ({ ...previous, appearance: { ...previous.appearance, cover: null } }));
    },
    discard: async (_id, assetId) => { assets.current.delete(assetId); },
  };
  return <AppearanceForm profileId="11111111-1111-4111-8111-111111111111" view={view} accentColor={view.appearance.accent} cover={cover} coverActions={actions} reviewOnly />;
}
