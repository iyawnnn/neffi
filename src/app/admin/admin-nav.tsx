import Link from "next/link";

const sections = [
  ["Dashboard", "/admin", "group-has-[[data-admin-section=dashboard]]:bg-muted", "group-has-[[data-admin-section=dashboard]]:block"],
  ["Orders", "/admin/orders", "group-has-[[data-admin-section=orders]]:bg-muted", "group-has-[[data-admin-section=orders]]:block"],
  ["Inventory", "/admin/inventory", "group-has-[[data-admin-section=inventory]]:bg-muted", "group-has-[[data-admin-section=inventory]]:block"],
  ["Customers", "/admin/customers", "group-has-[[data-admin-section=customers]]:bg-muted", "group-has-[[data-admin-section=customers]]:block"],
  ["Expenses", "/admin/expenses", "group-has-[[data-admin-section=expenses]]:bg-muted", "group-has-[[data-admin-section=expenses]]:block"],
  ["Support", "/admin/support", "group-has-[[data-admin-section=support]]:bg-muted", "group-has-[[data-admin-section=support]]:block"],
  ["Settings", "/admin/settings", "group-has-[[data-admin-section=settings]]:bg-muted", "group-has-[[data-admin-section=settings]]:block"],
] as const;
export function AdminNav() {
  return <nav aria-label="Owner navigation" className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap">{sections.map(([title, href, active, marker]) => <Link key={href} href={href} className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-sm ${active}`}>{title}<span className={`sr-only hidden ${marker}`}> (current section)</span></Link>)}</nav>;
}
