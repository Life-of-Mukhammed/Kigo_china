import { env } from "cloudflare:workers";
import { find } from "@/lib/kigo-store";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const media = await find(id);
  if (media?.deletedAt) return new Response(null, { status: 404 });
  const obj = await env.BUCKET.get(id);
  if (!obj) return new Response(null, { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type":
        obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public,max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
