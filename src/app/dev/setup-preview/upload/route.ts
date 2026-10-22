const available = () => process.env.NODE_ENV === "development" && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "development");

export async function POST() {
  if (!available()) return new Response(null, { status: 404 });
  return Response.json({ public_id: "synthetic-image" });
}
