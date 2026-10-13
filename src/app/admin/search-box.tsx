import { inputClass } from "@/components/ui/input";
export function SearchBox() {
  return <form action="/admin/search" className="flex gap-2"><label className="sr-only" htmlFor="admin-search">Search orders, customers, cards and tracking</label><input className={inputClass} id="admin-search" name="q" maxLength={100} placeholder="Search business records" /><button className="min-h-11 rounded-lg border px-3">Search</button></form>;
}
