import { Skeleton } from "@/components/ui/skeleton";
import { adminPage, adminPageNarrow, adminPageWide, Panel } from "./ui";

// Layout-shaped placeholders: each mirrors the page it stands in for (header, filters, table rows or phone records,
// charts, rail), so content arrives without the page jumping. Motion is the shared quiet pulse and stops for
// reduced-motion users.

function Busy({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <main className={className} aria-busy="true">
      <p role="status" className="sr-only">Loading</p>
      {children}
    </main>
  );
}

function HeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2"><Skeleton className="h-7 w-44" /><Skeleton className="h-4 w-72 max-w-full" /></div>
      {actions ? <div className="flex gap-2 max-sm:[&>*]:flex-1">{Array.from({ length: actions }, (_, index) => <Skeleton key={index} className="h-11 w-28 md:h-9" />)}</div> : null}
    </div>
  );
}

/** Desktop table rows and, below md, the tappable phone records. */
function RecordsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <>
      <Panel className="max-md:hidden">
        <div className="flex h-9 items-center gap-8 border-b bg-canvas/60 px-5"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-12" /><Skeleton className="ml-auto h-3 w-12" /></div>
        <ul className="divide-y">
          {Array.from({ length: rows }, (_, index) => (
            <li key={index} className="flex items-center justify-between gap-6 px-5 py-3.5">
              <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-28" /></div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        </ul>
      </Panel>
      <ul className="divide-y overflow-hidden rounded-panel border bg-background md:hidden">
        {Array.from({ length: Math.min(rows, 5) }, (_, index) => (
          <li key={index} className="flex min-h-[4.5rem] flex-col gap-2 px-4 py-3.5">
            <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-16" /></div>
            <Skeleton className="h-3 w-44 max-w-full" />
            <div className="flex items-center justify-between gap-3"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" /></div>
          </li>
        ))}
      </ul>
    </>
  );
}

function PaginationSkeleton() {
  return <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-44" /><Skeleton className="h-9 w-48 max-sm:w-32" /></div>;
}

function ChartSkeleton({ height = "h-56 sm:h-64" }: { height?: string }) {
  return (
    <Panel padded className="flex flex-col gap-5">
      <div className="flex gap-6"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div>
      <Skeleton className={`${height} w-full`} />
    </Panel>
  );
}

export function DashboardSkeleton() {
  return (
    <Busy className={adminPageWide}>
      <HeaderSkeleton actions={4} />
      <div className="grid overflow-hidden rounded-panel border bg-background lg:grid-cols-2 lg:divide-x">
        {Array.from({ length: 2 }, (_, group) => (
          <div key={group} className="flex flex-col">
            <div className="px-4 pt-3 sm:px-5"><Skeleton className="h-3 w-16" /></div>
            <div className="grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
              {Array.from({ length: 3 }, (_, index) => <div key={index} className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5 md:flex-col md:items-stretch md:py-4"><Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-24" /></div>)}
            </div>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="flex flex-col gap-4"><Skeleton className="h-5 w-28" /><ChartSkeleton /></div>
        <div className="flex flex-col gap-4"><Skeleton className="h-5 w-32" /><Panel><div className="divide-y">{Array.from({ length: 3 }, (_, index) => <div key={index} className="flex h-14 items-center justify-between px-5"><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-6" /></div>)}</div></Panel></div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col gap-4"><Skeleton className="h-5 w-20" /><ChartSkeleton /></div>
        <div className="flex flex-col gap-4"><Skeleton className="h-5 w-24" /><Panel padded className="flex flex-col gap-5">{Array.from({ length: 2 }, (_, index) => <div key={index} className="flex flex-col gap-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-full" /></div>)}</Panel></div>
      </div>
      <div className="flex flex-col gap-4"><Skeleton className="h-5 w-32" /><RecordsSkeleton rows={4} /></div>
    </Busy>
  );
}

export function ListSkeleton() {
  return (
    <Busy className={adminPageWide}>
      <HeaderSkeleton actions={1} />
      <div className="flex flex-wrap gap-3 border-y py-4"><Skeleton className="h-11 w-44 max-sm:flex-1 md:h-9" /><Skeleton className="h-11 w-44 max-sm:flex-1 md:h-9" /><Skeleton className="h-11 w-24 md:h-9" /></div>
      <RecordsSkeleton />
      <PaginationSkeleton />
    </Busy>
  );
}

export function DetailSkeleton() {
  return (
    <Busy className={adminPage}>
      <div className="flex flex-col gap-3"><Skeleton className="h-4 w-20" /><HeaderSkeleton actions={1} /></div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border bg-border md:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div key={index} className="flex flex-col gap-2 bg-background px-4 py-3.5 sm:px-5"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-24" /></div>)}
      </div>
      <Panel padded className="flex flex-col gap-4"><Skeleton className="h-4 w-36" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></Panel>
      <RecordsSkeleton rows={3} />
    </Busy>
  );
}

export function FormSkeleton() {
  return (
    <Busy className={adminPageNarrow}>
      <HeaderSkeleton />
      <Panel padded className="flex flex-col gap-5">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="flex flex-col gap-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-11 w-full md:h-9" /></div>)}
        <Skeleton className="h-11 w-32 md:h-9" />
      </Panel>
    </Busy>
  );
}

/** Two-column forms (new order, new support case): sections on the left, summary on the right. */
export function SummaryFormSkeleton() {
  return (
    <Busy className={adminPageWide}>
      <div className="flex flex-col gap-3"><Skeleton className="h-4 w-20" /><HeaderSkeleton /></div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <Panel className="divide-y">
          {Array.from({ length: 3 }, (_, section) => (
            <div key={section} className="flex flex-col gap-4 p-4 sm:p-5">
              <Skeleton className="h-4 w-28" />
              <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-11 w-full md:h-9" /><Skeleton className="h-11 w-full md:h-9" /></div>
            </div>
          ))}
        </Panel>
        <Panel padded className="flex flex-col gap-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-6 w-32" /></Panel>
      </div>
    </Busy>
  );
}
