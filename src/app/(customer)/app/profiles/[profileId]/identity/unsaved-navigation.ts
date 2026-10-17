export type HistoryNavigation = Event & {
  navigationType: string;
  canIntercept: boolean;
  destination: { url: string; key: string };
};

export type BrowserNavigation = EventTarget & { traverseTo: (key: string) => unknown };

export function guardHistoryNavigation(event: HistoryNavigation, discarding: boolean, saving: boolean, requestLeave: (url: string, key: string) => void) {
  if (discarding || event.navigationType !== "traverse" || !event.canIntercept || !event.cancelable) return;
  event.preventDefault();
  if (!saving) requestLeave(event.destination.url, event.destination.key);
}
