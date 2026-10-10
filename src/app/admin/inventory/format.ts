export const KIND_LABEL = { dbc: "Digital Business Card", grc: "Google Review Card", none: "Not yet assigned" } as const;

export const STATE_LABEL = { blank: "Blank", ready: "Ready", reserved: "Reserved", released: "Released", retired: "Retired" } as const;

// Fixed UTC so server-rendered output is identical wherever it runs.
export const dateTime = (value: Date) => `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
