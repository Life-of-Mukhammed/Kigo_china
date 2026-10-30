import {automaticBackup} from "@/lib/backups";
import { env } from "cloudflare:workers";
import { required, put, ApiError } from "@/lib/kigo-store";
export async function POST(request: Request) {
  try {
    const user = await required();
    if (
      request.headers.get("origin") &&
      new URL(request.headers.get("origin")!).origin !==
        new URL(request.url).origin
    )
      throw new ApiError("Noto‘g‘ri manba", 403);
    if (Number(request.headers.get("content-length")) > 12 * 1024 * 1024)
      throw new ApiError("Fayl 10 MB dan kichik bo‘lsin", 413);
    const data = await request.formData();
    const f = data.get("file");
    if (
      !(f instanceof File) ||
      f.size > 10 * 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(f.type)
    )
      throw new ApiError("JPG, PNG yoki WebP, 10 MB gacha");
    const bytes = await f.arrayBuffer(),
      h = new Uint8Array(bytes);
    const valid =
      f.type === "image/png"
        ? h[0] === 137 && h[1] === 80 && h[2] === 78 && h[3] === 71
        : f.type === "image/jpeg"
          ? h[0] === 255 && h[1] === 216 && h[2] === 255
          : h[0] === 82 &&
            h[1] === 73 &&
            h[2] === 70 &&
            h[3] === 70 &&
            h[8] === 87 &&
            h[9] === 69 &&
            h[10] === 66 &&
            h[11] === 80;
    if (!valid) throw new ApiError("Rasm formati noto‘g‘ri");
    const id = crypto.randomUUID(),
      url = "/api/files/" + id;
    await env.BUCKET.put(id, bytes, {
      httpMetadata: { contentType: f.type },
      customMetadata: { owner: user.id },
    });
    await put(id, "media", user.id, "", {
      name: f.name.slice(0, 150),
      url,
      mime: f.type,
      size: f.size,
      updatedAt: new Date().toISOString(),
    });
    await automaticBackup().catch(()=>{});
    return Response.json({ id, url });
  } catch (e) {
    if (e instanceof ApiError)
      return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json(
      { error: "Rasmni yuklash amalga oshmadi" },
      { status: 500 },
    );
  }
}
