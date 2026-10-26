import { pgEnum } from "drizzle-orm/pg-core";

// Locked, slow-changing state sets. Adding a value is a reviewed migration (ALTER TYPE ... ADD VALUE).
export const accountRole = pgEnum("account_role", ["customer", "owner"]);
export const productKind = pgEnum("product_kind", ["dbc", "grc"]);
export const orderStatus = pgEnum("order_status", ["in_progress", "completed", "cancelled"]);
export const deliveryMethod = pgEnum("delivery_method", ["pickup", "local_handoff", "courier"]);
export const paymentMethod = pgEnum("payment_method", ["gcash", "bank_transfer", "cash", "maya", "maribank", "gotyme"]);
export const shipmentStatus = pgEnum("shipment_status", ["pending", "in_transit", "delivered", "failed", "returned", "lost"]);
export const cardState = pgEnum("card_state", ["blank", "ready", "reserved", "released", "retired", "preparing"]);
export const profileStatus = pgEnum("profile_status", ["draft", "published", "unpublished"]);
export const profileLayout = pgEnum("profile_layout", ["classic", "editorial", "showcase"]);
export const profileColorMode = pgEnum("profile_color_mode", ["light", "dark"]);
export const profileGoal = pgEnum("profile_goal", ["networking", "freelance", "business", "student"]);
export const blockType = pgEnum("block_type", ["about", "project", "link", "contact", "booking", "form"]);
export const formPreset = pgEnum("form_preset", ["connect", "project_inquiry", "contact"]);
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
  "threads",
  "discord",
  "reddit",
  "pinterest",
  "behance",
  "dribbble",
]);
export const expenseCategory = pgEnum("expense_category", [
  "inventory_production",
  "shipping_delivery",
  "packaging_printing",
  "software_operations",
  "marketing",
  "other",
]);
export const supportCaseType = pgEnum("support_case_type", [
  "activation_issue",
  "account_recovery",
  "ownership_correction",
  "defective_card",
  "shipping_issue",
  "replacement",
  "other",
]);
export const supportCaseStatus = pgEnum("support_case_status", ["open", "waiting_on_customer", "resolved"]);
export const supportCaseSource = pgEnum("support_case_source", ["owner", "public", "account"]);
// `replacement` marks a free/support replacement card; it stays linked to the case instead of becoming a sale.
export const supportCaseCardRole = pgEnum("support_case_card_role", ["affected", "replacement"]);
