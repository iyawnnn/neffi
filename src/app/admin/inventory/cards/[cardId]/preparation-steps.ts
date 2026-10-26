export type StepCard = {
  kind: "dbc" | "grc" | null;
  state: "blank" | "preparing" | "ready" | "reserved" | "released" | "retired";
  publicToken: string | null;
  nfcVerifiedAt: Date | null;
  packageMatchedAt: Date | null;
};

export type StepKey = "provision" | "nfc" | "package" | "ready" | "released" | "retired" | "none";

// Where a DBC is in physical preparation, from the persisted facts only (never fabricated for legacy cards).
export function preparationSteps(card: StepCard): { current: StepKey; steps: { label: string; done: boolean }[] } {
  const steps = [
    { label: "Write NFC", done: Boolean(card.nfcVerifiedAt) },
    { label: "Confirm NFC test", done: Boolean(card.nfcVerifiedAt) },
    { label: "Confirm package", done: Boolean(card.packageMatchedAt) },
    { label: "Ready for customer", done: ["ready", "reserved", "released"].includes(card.state) },
  ];
  if (card.kind === "grc") return { current: "none", steps };
  if (card.state === "retired") return { current: "retired", steps };
  if (card.state === "released") return { current: "released", steps };
  if (card.state === "ready" || card.state === "reserved") return { current: "ready", steps };
  if (!card.publicToken) return { current: "provision", steps };
  return { current: card.nfcVerifiedAt ? "package" : "nfc", steps };
}
