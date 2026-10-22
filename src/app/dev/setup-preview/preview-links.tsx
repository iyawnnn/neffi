"use client";

import { useEffect, useState } from "react";
import { SetupLinks } from "@/app/(customer)/app/setup/[cardId]/setup-links";
import { setupDraft } from "@/app/(customer)/app/setup/[cardId]/setup-draft";
import type { ModeEditorActions, ModeEditorItem } from "@/app/(customer)/app/profiles/[profileId]/scenes/[sceneId]/mode-editor";
import type { FormConfig } from "@/modules/forms/config";
import type { Goal } from "@/modules/profiles/goals";
import type { SceneView } from "@/modules/profiles/scene-view";

const existing: ModeEditorItem[] = [
  { id: "synthetic-link", type: "link", visible: true, content: { kind: "linkedin", label: "", url: "https://linkedin.com/in/ana" }, summary: "LinkedIn" },
  { id: "synthetic-project", type: "project", visible: true, content: { title: "Neighbourhood guide", description: "A local discovery project", url: "https://ana.example.test/guide" }, summary: "Neighbourhood guide" },
];
const empty: ModeEditorItem[] = [];
const fields = ["type", "kind", "label", "url", "text", "title", "description", "saveContact", "preset"];
const fallback = (goal: Goal | null) => setupDraft(null, { fullName: "Ana Santos", headline: "Independent designer", phone: "9171234567", email: "ana@example.test", website: "ana.example.test" }, goal);
const startingBlocks = (items: "empty" | "existing") => items === "existing" ? existing : empty;
type LoadedItem = NonNullable<Awaited<ReturnType<ModeEditorActions["load"]>>>;

export function PreviewLinks({ goal, items }: { goal: Goal | null; items: "empty" | "existing" }) {
  const [blocks, setBlocks] = useState<ModeEditorItem[]>(() => startingBlocks(items));
  const [view, setView] = useState<SceneView>(() => fallback(goal));
  useEffect(() => {
    void fetch("/dev/setup-preview/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blocks: startingBlocks(items), operation: "view", fields: {} }) })
      .then(response => response.ok ? response.json() : null).then(result => { if (result?.view) setView(result.view); });
  }, [items]);
  const actions: ModeEditorActions = {
    load: async (_profileId, sceneId, blockId) => {
      const item = blocks.find(block => block.id === blockId);
      if (!item) throw new Error("Synthetic item unavailable");
      const form: LoadedItem["form"] = item.type === "form"
        ? { id: item.id, title: "Contact form", config: { fields: { name: "required", email: "required", phone: "optional", company: "hidden", message: "required" }, questions: [] } satisfies FormConfig, useCount: 1 }
        : null;
      return { ...item, sceneId, formId: item.type === "form" ? item.id : null, form };
    },
    mutate: async data => {
      const payload = { blocks, operation: String(data.get("operation") ?? ""), blockId: String(data.get("blockId") ?? ""), fields: Object.fromEntries([...data.entries()].filter(([key, value]) => fields.includes(key) && typeof value === "string")) };
      try {
        const response = await fetch("/dev/setup-preview/items", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json();
        if (!response.ok) return { error: result.error || "Check the item fields." };
        setBlocks(result.blocks); setView(result.view);
        return { ok: true };
      } catch {
        return { error: "The development preview is unavailable." };
      }
    },
  };
  return <SetupLinks suffix="TEST" goal={goal} profileId="synthetic-profile" sceneId="synthetic-scene" blocks={blocks} view={view} actions={actions} />;
}
