import { NextResponse, type NextRequest } from "next/server";
import { getViewerFromHeaders } from "@/auth/access";
import { db } from "@/db";
import { resolveCard } from "@/modules/cards/resolve";
import { CARD_REQUEST_HEADER, createCardRequest, signCardRequest } from "@/modules/cards/request";

export async function proxy(request: NextRequest) {
  let token: string;
  try { token = decodeURIComponent(request.nextUrl.pathname.split("/")[2]); }
  catch { token = ""; }
  const [route, viewer] = await Promise.all([resolveCard(db, token), getViewerFromHeaders(request.headers)]);
  const snapshot = createCardRequest(route, viewer);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(CARD_REQUEST_HEADER);
  if (!snapshot) {
    // Next treats an unavailable Flight response as a document navigation to the same permanent URL.
    if (request.headers.get("rsc") === "1") {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
    }
    const destination = request.nextUrl.clone();
    destination.pathname = "/c-unavailable";
    return NextResponse.rewrite(destination, { status: 404, request: { headers: requestHeaders } });
  }
  requestHeaders.set(CARD_REQUEST_HEADER, signCardRequest(token, snapshot));
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = { matcher: "/c/:token" };
