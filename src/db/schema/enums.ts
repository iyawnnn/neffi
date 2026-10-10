import { pgEnum } from "drizzle-orm/pg-core";

// Locked, slow-changing state sets. Adding a value is a reviewed migration (ALTER TYPE ... ADD VALUE).
export const accountRole = pgEnum("account_role", ["customer", "owner"]);
export const productKind = pgEnum("product_kind", ["dbc", "grc"]);
export const orderStatus = pgEnum("order_status", ["in_progress", "completed", "cancelled"]);
export const deliveryMethod = pgEnum("delivery_method", ["pickup", "local_handoff", "courier"]);
export const paymentMethod = pgEnum("payment_method", ["gcash", "bank_transfer", "cash"]);
export const shipmentStatus = pgEnum("shipment_status", ["pending", "in_transit", "delivered", "failed", "returned", "lost"]);
export const cardState = pgEnum("card_state", ["blank", "ready", "reserved", "released", "retired"]);
export const profileStatus = pgEnum("profile_status", ["draft", "published", "unpublished"]);
export const profileLinkType = pgEnum("profile_link_type", [
  "facebook",
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "github",
  "messenger",
  "whatsapp",
  "viber",
  "telegram",
  "x",
  "portfolio",
  "booking",
  "shop",
  "menu",
  "custom",
]);
