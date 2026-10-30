import {automaticBackup} from "@/lib/backups";
import { z } from "zod";
import { listRecords, writeRecords } from "@/lib/record-store";
import {
  ApiError,
  admin,
  find,
  statement,
  audit,
  isOwnerEmail,
  decode,
  type Entity,
} from "@/lib/kigo-store";
export const dynamic = "force-dynamic";
const respond = (d: unknown, status = 200) =>
  Response.json(d, { status, headers: { "Cache-Control": "no-store" } });
const kinds = [
  "account",
  "tournament",
  "organizer",
  "athlete",
  "team",
  "ad",
  "sponsor",
  "review",
  "registration",
  "match",
  "contact",
  "message",
  "media",
  "audit",
  "settings",
];
export async function GET(request: Request) {
  try {
    const user = await admin();
    const url = new URL(request.url),
      kind = url.searchParams.get("kind") || "overview";
    if (kind === "overview") {
      const all = await listRecords();
      const counts = [...new Set(all.map((row) => row.kind))].map((k) => ({kind:k,n:all.filter((row)=>row.kind===k&&!JSON.parse(row.data).deletedAt).length}));
      const eventCounts = new Map<string,{target:string;event:string;n:number}>();
      for(const row of all.filter((item)=>item.kind==="ad-event")){const event=JSON.parse(row.data).event as string,key=row.target+":"+event,current=eventCounts.get(key);eventCounts.set(key,{target:row.target,event,n:(current?.n||0)+1})}
      const recent = all.filter((row)=>row.kind==="audit").sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,20);
      return respond({
        user,
        counts,
        adStats: [...eventCounts.values()],
        recent: recent.map(decode),
      });
    }
    if (!kinds.includes(kind)) throw new ApiError("Bo‘lim topilmadi", 404);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1),
      q = (url.searchParams.get("q") || "").slice(0, 100),
      archived = url.searchParams.get("archived") === "1";
    const matching = (await listRecords(kind)).filter((row) => {
      const deleted = !!JSON.parse(row.data).deletedAt;
      return deleted === archived && (!q || row.data.toLowerCase().includes(q.toLowerCase()) || row.id.toLowerCase().includes(q.toLowerCase()));
    }).sort((a,b)=>b.created_at.localeCompare(a.created_at));
    const total = matching.length;
    const rows = matching.slice((page - 1) * 30, page * 30);
    return respond({
      items: rows.map(decode),
      page,
      total,
      pages: Math.max(1, Math.ceil(total / 30)),
      user,
    });
  } catch (e) {
    return error(e);
  }
}
async function handlePOST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      new URL(request.headers.get("origin")!).origin !==
        new URL(request.url).origin
    )
      throw new ApiError("Noto‘g‘ri manba", 403);
    const user = await admin();
    const raw = await request.text();
    if (raw.length > 20000) throw new ApiError("So‘rov hajmi katta", 413);
    const b = z
      .object({
        action: z.enum(["user-update", "moderate", "ticket-status"]),
        id: z.string().max(500),
        role: z.enum(["user", "organizer", "admin"]).optional(),
        status: z.string().max(40).optional(),
      })
      .parse(JSON.parse(raw));
    const r = await find(b.id);
    if (!r) throw new ApiError("Yozuv topilmadi", 404);
    let next: Entity = { ...r, updatedAt: new Date().toISOString() };
    if (b.action === "user-update") {
      if (r.kind !== "account") throw new ApiError("Hisob topilmadi");
      if (isOwnerEmail(r.email) || r.ownerId === user.id)
        throw new ApiError(
          "Sayt egasining huquqi bu paneldan o‘zgartirilmaydi",
        );
      if (!user.isOwner && (b.role === "admin" || r.role === "admin"))
        throw new ApiError(
          "Admin huquqini o‘zgartirish faqat sayt egasi uchun",
          403,
        );
      if (b.status && !["active", "suspended"].includes(b.status))
        throw new ApiError("Holat noto‘g‘ri");
      next = {
        ...next,
        ...(b.role ? { role: b.role } : {}),
        ...(b.status ? { status: b.status } : {}),
      };
    }
    if (b.action === "moderate") {
      if (
        r.kind !== "review" ||
        !["approved", "pending", "rejected"].includes(b.status || "")
      )
        throw new ApiError("Sharh holati noto‘g‘ri");
      next = { ...next, status: b.status };
    }
    if (b.action === "ticket-status") {
      if (
        !["message", "contact"].includes(r.kind) ||
        !["new", "in_progress", "closed", "replied"].includes(b.status || "")
      )
        throw new ApiError("Xabar holati noto‘g‘ri");
      next = { ...next, status: b.status };
    }
    await writeRecords([
      statement(r.id, r.kind, r.ownerId, r.target || r.slug || "", next),
      await audit(user.id, b.action, r.id, r, next),
    ]);
    return respond({ ok: true });
  } catch (e) {
    return error(e);
  }
}
function error(e: unknown) {
  if (e instanceof ApiError) return respond({ error: e.message }, e.status);
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return respond({ error: "Ma’lumotlarni tekshiring" }, 400);
  console.error(e);
  return respond({ error: "Server xatosi" }, 500);
}

export async function POST(request:Request){const response=await handlePOST(request);if(response.ok){try{response.headers.set("X-Kigo-Backup",await automaticBackup())}catch{response.headers.set("X-Kigo-Backup","failed")}}return response}
