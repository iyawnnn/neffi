import { PRESETS } from "@/modules/forms/config";
import { buildSceneView } from "@/modules/profiles/scene-view";
import { parseBlockContent, type BlockType } from "@/modules/profiles/block-content";
import { PLATFORMS } from "@/modules/profiles/platform-registry";

type Item = { id: string; type: BlockType; visible: boolean; content: Record<string, unknown>; summary: string };
const available = () => process.env.NODE_ENV === "development" && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development");
const types = ["about", "project", "link", "contact", "booking", "form"] as const satisfies readonly BlockType[];

const summary = (type: BlockType, content: Record<string, unknown>) => type === "link" ? PLATFORMS[String(content.kind) as keyof typeof PLATFORMS]?.label ?? "Custom link" : type === "form" ? "Contact form" : type === "project" ? String(content.title) : type === "booking" ? String(content.label || "Book a meeting") : type === "about" ? "About" : "Save contact";
const view = (blocks: Item[]) => buildSceneView({
  profile: { fullName: "Ana Santos", headline: "Independent designer", company: "Santos Studio", bio: "I help growing teams make useful things.", phone: "+639171234567", email: "ana@example.test", website: "https://ana.example.test/", location: "Cebu City", accentColor: null, imageIsLogo: false, layout: "showcase", colorMode: "light" },
  imageUrl: null, scene: { id: "synthetic-scene", name: "Default" },
  blocks: blocks.map((block, position) => ({ ...block, position, formId: block.type === "form" ? block.id : null })),
  forms: blocks.filter(block => block.type === "form").map(block => ({ id: block.id, title: "Contact form", config: PRESETS.contact.config })),
});

export async function POST(request: Request) {
  if (!available()) return new Response(null, { status: 404 });
  const body = await request.json().catch(() => null) as { blocks?: Item[]; operation?: string; blockId?: string; fields?: Record<string, string> } | null;
  if (!body || !Array.isArray(body.blocks) || !body.fields) return Response.json({ error: "Invalid synthetic item." }, { status: 400 });
  const fields = body.fields;
  const type = types.includes(fields.type as BlockType) ? fields.type as BlockType : null;
  let blocks = body.blocks.filter(block => types.includes(block.type));
  if (body.operation === "view") return Response.json({ ok: true, blocks, view: view(blocks) });
  if (body.operation === "remove") blocks = blocks.filter(block => block.id !== body.blockId);
  else if ((body.operation === "add" || body.operation === "update") && type) {
    const allowed = { about: ["text"], project: ["title", "description", "url"], link: ["kind", "label", "url"], contact: ["saveContact"], booking: ["label", "url"], form: [] } satisfies Record<BlockType, string[]>;
    const content = Object.fromEntries(allowed[type].flatMap(key => fields[key] === undefined ? [] : [[key, fields[key]] ]));
    const parsed = parseBlockContent(type, content);
    if (!parsed.ok) return Response.json({ error: "Check the item fields." }, { status: 400 });
    const item: Item = { id: body.operation === "update" ? body.blockId || "synthetic-item" : `synthetic-${crypto.randomUUID()}`, type, visible: true, content: parsed.content, summary: summary(type, parsed.content) };
    blocks = body.operation === "update" ? blocks.map(block => block.id === item.id ? { ...block, ...item, visible: block.visible } : block) : [...blocks, item];
  } else return Response.json({ error: "Invalid synthetic item." }, { status: 400 });
  return Response.json({ ok: true, blocks, view: view(blocks) });
}
