import { ChartNoAxesCombined, ClipboardList, LifeBuoy, Package, Receipt, Settings, Users, type LucideIcon } from "lucide-react";

export type NavSection = { key: string; title: string; href: string; icon: LucideIcon };
export type NavGroup = { label: string; items: readonly NavSection[] };

export const navGroups: readonly NavGroup[] = [
  { label: "Overview", items: [{ key: "dashboard", title: "Dashboard", href: "/admin", icon: ChartNoAxesCombined }] },
  {
    label: "Operations",
    items: [
      { key: "orders", title: "Orders", href: "/admin/orders", icon: ClipboardList },
      { key: "inventory", title: "Inventory", href: "/admin/inventory", icon: Package },
      { key: "customers", title: "Customers", href: "/admin/customers", icon: Users },
      { key: "expenses", title: "Expenses", href: "/admin/expenses", icon: Receipt },
    ],
  },
  { label: "Service", items: [{ key: "support", title: "Support", href: "/admin/support", icon: LifeBuoy }] },
  { label: "System", items: [{ key: "settings", title: "Settings", href: "/admin/settings", icon: Settings }] },
];

export const navSections: readonly NavSection[] = navGroups.flatMap((group) => group.items);

/** The one section a route belongs to; nested routes activate their parent, unknown routes (search) none. */
export function activeSection(pathname: string | null): string | null {
  if (!pathname) return null;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/admin") return "dashboard";
  return navSections.find((section) => section.href !== "/admin" && (path === section.href || path.startsWith(`${section.href}/`)))?.key ?? null;
}
