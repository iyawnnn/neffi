export const categories = {
  activation: { label: "Lost activation code", type: "activation_issue" },
  ownership: { label: "Card in the wrong account or not found", type: "ownership_correction" },
  recovery: { label: "Cannot sign in or lost email or Google access", type: "account_recovery" },
  defective: { label: "Card damaged or not working", type: "defective_card" },
  shipping: { label: "Delivery problem", type: "shipping_issue" },
  other: { label: "Other", type: "other" },
} as const;
