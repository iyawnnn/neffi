import { DashboardSkeleton } from "./skeletons";

// The dashboard is the only route that streams from /admin itself; every other section has its own loading file.
export default function AdminLoading() {
  return <DashboardSkeleton />;
}
