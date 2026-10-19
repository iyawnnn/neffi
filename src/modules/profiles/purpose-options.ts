export type Purpose = "network" | "get_clients" | "show_my_work";
export const PURPOSES: Record<Purpose, { label: string; description: string; sceneName: string; linkLabel: string }> = {
  network: { label: "Network", description: "Share your contact details and stay in touch.", sceneName: "Networking", linkLabel: "LinkedIn or main profile link" },
  get_clients: { label: "Get Clients", description: "Show what you offer and make it easy to reach you.", sceneName: "Clients", linkLabel: "Booking link" },
  show_my_work: { label: "Show My Work", description: "Show your projects and where to see more.", sceneName: "My work", linkLabel: "Portfolio link" },
};
export const isPurpose = (value: unknown): value is Purpose => typeof value === "string" && Object.hasOwn(PURPOSES, value);
