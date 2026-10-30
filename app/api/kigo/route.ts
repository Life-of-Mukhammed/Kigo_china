import {automaticBackup} from "@/lib/backups";
import {googleReady} from "@/lib/app-auth";
import {ensureDemoContent} from "@/lib/demo-content";
import { z } from "zod";
import { listRecords, writeRecords, incrementRateRecord, createRegistrationIfAvailable, pingRecordStore } from "@/lib/record-store";
import { env } from "cloudflare:workers";
import {
  ApiError,
  identity,
  required,
  admin,
  list,
  find,
  put,
  statement,
  audit,
  clean,
  schemas,
  settings,
  published,
  tournamentView,
  standings,
  slugify,
  type Entity,
  type ManagedKind,
  type Row,
} from "@/lib/kigo-store";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function data() {
  const [
    tournaments,
    organizers,
    athletes,
    teams,
    registrations,
    matches,
    reviews,
    ads,
    sponsors,
    config,
    ranks,
  ] = await Promise.all([
    list("tournament"),
    list("organizer"),
    list("athlete"),
    list("team"),
    list("registration"),
    list("match"),
    list("review"),
    list("ad"),
    list("sponsor"),
    settings(),
    standings(),
  ]);
  const now = new Date().toISOString().slice(0, 10);
  const activeAds = ads
    .filter(
      (a) =>
        a.status === "active" &&
        (!a.startDate || a.startDate <= now) &&
        (!a.endDate || a.endDate >= now),
    )
    .sort((a, b) => b.priority - a.priority);
  return {
    tournaments,
    organizers,
    athletes,
    teams,
    registrations,
    matches,
    reviews,
    ads: activeAds,
    sponsors: sponsors.filter((s) => s.active),
    config,
    ranks,
  };
}
async function stats() {
  const rows = await listRecords();
  const values = rows.map((row) => ({ ...row, ...JSON.parse(row.data) }));
  const n = Object.fromEntries([...new Set(values.map((row) => row.kind))].map((kind) => [kind, values.filter((row) => row.kind === kind && !row.deletedAt && (kind !== "account" || row.status !== "suspended")).length]));
  const tournaments = values.filter((row) => row.kind === "tournament" && !row.deletedAt);
  const complete = tournaments.filter((row) => row.status === "tugagan").length;
  const sports = new Set(tournaments.filter((row) => row.status !== "draft").map((row) => row.sport)).size;
  return {
    completedTournaments: complete,
    registeredUsers: n.account || 0,
    organizers: n.organizer || 0,
    sports,
    teams: n.team || 0,
    matches: n.match || 0,
  };
}
function reviewView(r: Entity, userId?: string) {
  return { ...clean(r), mine: r.ownerId === userId };
}
export async function GET(request: Request) {
  try {
    const url = new URL(request.url),
      action = url.searchParams.get("action") || "bootstrap";
    if (action === "health") {
      await pingRecordStore();
      return json({ ok: true, database: true, files: !!env.BUCKET });
    }
    await ensureDemoContent();
    const u = await identity(true);
    const d = await data();
    if (action === "tournament") {
      const t = d.tournaments.find(
        (t) => t.slug === url.searchParams.get("slug"),
      );
      if (!t || (!published(t) && t.ownerId !== u?.id && u?.role !== "admin"))
        throw new ApiError("Turnir topilmadi", 404);
      const canManage = t.ownerId === u?.id || u?.role === "admin";
      const participants = d.registrations.filter((r) => r.slug === t.slug);
      return json({
        tournament: tournamentView(t, d.registrations),
        organizer: d.organizers.find((o) => o.id === t.organizerId)
          ? clean(d.organizers.find((o) => o.id === t.organizerId)!)
          : null,
        isOwner: canManage,
        user: u,
        participants: canManage
          ? participants
          : participants
              .filter((r) => r.status === "confirmed")
              .map((r) => ({
                team: r.team,
                count: r.count,
                status: r.status,
                teamId: r.teamId,
              })),
        myRegistration: participants.find((r) => r.ownerId === u?.id) || null,
        matches: d.matches.filter((m) => m.slug === t.slug).map(clean),
        reviews: d.reviews
          .filter((r) => r.target === t.id && r.status === "approved")
          .map((r) => reviewView(r, u?.id)),
        teams: d.teams.map(clean),
        athletes: d.athletes.map(clean),
      });
    }
    const tournaments = d.tournaments
      .filter(published)
      .map((t) => tournamentView(t, d.registrations));
    if (action === "search") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      return json({
        tournaments: tournaments.filter((t) =>
          (t.name + " " + t.sport + " " + t.city).toLowerCase().includes(q),
        ),
        organizers: d.organizers
          .filter((o) => o.name.toLowerCase().includes(q))
          .map(clean),
        athletes: d.athletes
          .filter((a) => a.name.toLowerCase().includes(q))
          .map(clean),
      });
    }
    const [bookmarks, follows, messages, media] = u
      ? await Promise.all([
          list("bookmark", u.id),
          list("follow", u.id),
          Promise.all([list("message"), list("contact")]).then((rows) =>
            rows.flat(),
          ),
          list("media", u.id),
        ])
      : [[], [], [], []];
    return json({
      user: u,
      tournaments,
      organizers: d.organizers.map((o) => ({
        ...clean(o),
        rating: average(
          d.reviews.filter((r) => r.target === o.id && r.status === "approved"),
        ),
        reviews: d.reviews
          .filter((r) => r.target === o.id && r.status === "approved")
          .map((r) => reviewView(r, u?.id)),
        tournaments: tournaments.filter((t) => t.organizerId === o.id).length,
      })),
      athletes: d.ranks.athletes,
      teams: d.ranks.teams,
      reviews: d.reviews
        .filter((r) => r.status === "approved")
        .map((r) => reviewView(r, u?.id)),
      ads: d.ads.map(clean),
      sponsors: d.sponsors.map(clean),
      settings: clean(d.config),
      stats: await stats(),
      bookmarks,
      follows,
      registrations: d.registrations.filter((r) => r.ownerId === u?.id),
      mine: d.tournaments
        .filter((t) => t.ownerId === u?.id)
        .map((t) => ({
          ...tournamentView(t, d.registrations),
          registrations: d.registrations.filter((r) => r.slug === t.slug),
        })),
      myOrganizers: d.organizers.filter((o) => o.ownerId === u?.id),
      myTeams: d.teams.filter((t) => t.ownerId === u?.id),
      myReviews: d.reviews.filter((r) => r.ownerId === u?.id),
      messages: messages
        .filter((m) => m.ownerId === u?.id || m.recipientId === u?.id)
        .map((m) => ({ ...m, outgoing: m.ownerId === u?.id })),
      media,
      services: { sms: false, payments: false, identity: "chatgpt", google:googleReady() },
    });
  } catch (e) {
    return fail(e);
  }
}
function average(r: Entity[]) {
  return r.length
    ? Math.round((r.reduce((s, r) => s + r.rating, 0) / r.length) * 10) / 10
    : null;
}
function fail(e: unknown) {
  if (e instanceof ApiError) return json({ error: e.message }, e.status);
  if (e instanceof z.ZodError)
    return json(
      {
        error: e.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
      },
      400,
    );
  console.error(e);
  return json({ error: "Server xatosi. Qayta urinib ko‘ring." }, 500);
}
async function payload(request: Request) {
  if (
    request.headers.get("origin") &&
    new URL(request.headers.get("origin")!).origin !==
      new URL(request.url).origin
  )
    throw new ApiError("Noto‘g‘ri manba", 403);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 65536)
    throw new ApiError("So‘rov hajmi katta", 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ApiError("So‘rov JSON formati noto‘g‘ri", 400);
  }
  return z.record(z.unknown()).parse(parsed);
}
async function limit(owner: string) {
  const bucket = Math.floor(Date.now() / 60000),
    id = "rate:" + owner + ":" + bucket;
  const count = await incrementRateRecord(id, owner);
  if (count > 90)
    throw new ApiError("Juda ko‘p so‘rov. Bir daqiqa kuting.", 429);
}
async function handlePOST(request: Request) {
  try {
    const b = await payload(request);
    const u = await required();
    await limit(u.id);
    const action = b.action;
    if (action === "entity-save" || action === "tournament") {
      const kind = (
        action === "tournament" ? "tournament" : b.kind
      ) as ManagedKind;
      if (typeof kind !== "string" || !Object.hasOwn(schemas, kind))
        throw new ApiError("Noma’lum tur");
      if (
        ["ad", "sponsor", "settings", "athlete"].includes(kind) &&
        u.role !== "admin"
      )
        throw new ApiError("Admin huquqi kerak", 403);
      const parsed: Entity = schemas[kind].parse(
        action === "tournament" ? b : b.data,
      );
      const prev = parsed.id
        ? await find(parsed.id)
        : kind === "settings"
          ? await find("settings:site")
          : null;
      if (parsed.id && (!prev || prev.kind !== kind || prev.deletedAt))
        throw new ApiError("Yozuv topilmadi", 404);
      if (prev && prev.ownerId !== u.id && u.role !== "admin")
        throw new ApiError("Ruxsat yo‘q", 403);
      if (
        prev &&
        b.expectedUpdatedAt !== undefined &&
        b.expectedUpdatedAt !== prev.updatedAt
      )
        throw new ApiError("Yozuv boshqa oynada o‘zgargan. Yangilang.", 409);
      if (kind === "tournament") {
        if (
          parsed.status !== "draft" &&
          (!parsed.startDate ||
            !parsed.endDate ||
            parsed.endDate < parsed.startDate ||
            parsed.address.trim().length < 3 ||
            !parsed.img)
        )
          throw new ApiError(
            "Turnir sanasi, manzili va muqovasini to‘liq kiriting",
          );
        if (parsed.organizerId) {
          const o = await find(parsed.organizerId);
          if (
            !o ||
            o.kind !== "organizer" ||
            o.deletedAt ||
            (o.ownerId !== u.id && u.role !== "admin")
          )
            throw new ApiError("Tashkilotchini tanlang");
        } else if (parsed.status !== "draft")
          throw new ApiError(
            "E’lon qilishdan oldin tashkilotchi profilini yarating",
          );
        if (
          parsed.registrationDeadline &&
          parsed.startDate &&
          parsed.registrationDeadline > parsed.startDate
        )
          throw new ApiError(
            "Ro‘yxat muddati turnir boshlanishidan oldin bo‘lsin",
          );
        if (prev) {
          const regs = (await list("registration")).filter(
            (r) =>
              r.slug === prev.slug &&
              !["cancelled", "rejected"].includes(r.status),
          );
          if (parsed.capacity < regs.length)
            throw new ApiError(
              "Sig‘im mavjud arizalar sonidan kam bo‘lolmaydi",
            );
        }
      }
      if (kind === "organizer" && u.role !== "admin") parsed.verified = false;
      if (
        kind === "ad" &&
        parsed.endDate &&
        parsed.startDate &&
        parsed.endDate < parsed.startDate
      )
        throw new ApiError("Reklama tugash sanasi noto‘g‘ri");
      if (kind === "team") {
        const players = await list("athlete");
        if (
          parsed.players.some((id: string) => !players.some((a) => a.id === id))
        )
          throw new ApiError("Sportchilar ro‘yxatini tekshiring");
      }
      const id =
        prev?.id ||
        (kind === "settings" ? "settings:site" : crypto.randomUUID());
      const owner =
        prev?.ownerId ||
        (u.role === "admin" && parsed.ownerId ? parsed.ownerId : u.id);
      if (owner !== u.id && !(await find("account:" + owner)))
        throw new ApiError("Ega hisob topilmadi");
      const result: Entity = {
        ...parsed,
        id,
        slug:
          prev?.slug || slugify(parsed.name || "kigo") + "-" + id.slice(0, 8),
        updatedAt: new Date(
          Math.max(Date.now(), (Date.parse(prev?.updatedAt || "") || 0) + 1),
        ).toISOString(),
      };
      delete result.ownerId;
      const expectedUpdatedAt = typeof b.expectedUpdatedAt === "string" ? b.expectedUpdatedAt : undefined;
      const guarded = !!prev && expectedUpdatedAt !== undefined;
      const query = statement(id, kind, owner, result.slug, result, guarded ? { expectedUpdatedAt } : {});
      const saved = await writeRecords([
        query,
        await audit(
          u.id,
          prev ? "update" : "create",
          id,
          prev,
          result,
          !!guarded,
        ),
      ]);
      if (guarded && !saved[0])
        throw new ApiError("Yozuv boshqa oynada o‘zgargan. Yangilang.", 409);
      return json({ ...result, ownerId: owner });
    }
    if (action === "entity-delete" || action === "entity-restore") {
      const { id } = z.object({ id: z.string().max(300) }).parse(b);
      const r = await find(id);
      if (!r) throw new ApiError("Topilmadi", 404);
      if (
        u.role !== "admin" &&
        (r.ownerId !== u.id ||
          !["tournament", "organizer", "team", "review"].includes(r.kind))
      )
        throw new ApiError("Ruxsat yo‘q", 403);
      if (r.kind === "account" || r.kind === "settings" || r.kind === "audit")
        throw new ApiError("Bu yozuvni bu yerdan o‘chirib bo‘lmaydi");
      if (action === "entity-delete" && r.kind === "media") {
        const used = (await listRecords()).some((row) => ["tournament","organizer","athlete","team","ad","sponsor","settings","profile"].includes(row.kind) && !JSON.parse(row.data).deletedAt && row.data.includes("/api/files/" + r.id));
        if (used)
          throw new ApiError(
            "Bu rasm saytda ishlatilmoqda. Avval tegishli yozuvdagi rasmni almashtiring.",
            409,
          );
      }
      if (action === "entity-delete" && r.kind === "organizer") {
        const linked = (await list("tournament")).some(
          (t) => t.organizerId === r.id && published(t),
        );
        if (linked)
          throw new ApiError(
            "Tashkilotchining e’lon qilingan turnirlari bor. Avval ularni arxivlang yoki tashkilotchisini almashtiring.",
            409,
          );
      }
      const next = {
        ...r,
        deletedAt: action === "entity-delete" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      };
      await writeRecords([
        statement(r.id, r.kind, r.ownerId, r.target || r.slug || "", next),
        await audit(u.id, action, r.id, r, next),
      ]);
      return json({ ok: true });
    }
    if (action === "profile") {
      const p = z
        .object({
          name: z.string().trim().min(2).max(100),
          phone: z.string().max(30).default(""),
          city: z.string().max(80).default(""),
          sport: z.string().max(60).default(""),
          bio: z.string().max(3000).default(""),
          image: z.string().max(400).default(""),
          notifications: z.record(z.boolean()).default({}),
          onboarded: z.boolean().default(true),
        })
        .parse(b);
      if (p.image && !/^\/(media|assets|api\/files)\//.test(p.image))
        throw new ApiError("Rasm manzili noto‘g‘ri");
      const id = "profile:" + u.id;
      const old = await find(id);
      const athleteId = "athlete:" + u.id;
      const a = await find(athleteId);
      await writeRecords([statement(id, "profile", u.id, "", {
          ...old,
          ...p,
          updatedAt: new Date().toISOString(),
        })]);
      await writeRecords([statement(athleteId, "athlete", u.id, "", {
          ...a,
          name: p.name,
          city: p.city,
          sport: p.sport,
          bio: p.bio,
          image: p.image,
          userId: u.id,
          slug: a?.slug || slugify(p.name) + "-" + u.id.slice(-8),
          updatedAt: new Date().toISOString(),
        })]);
      return json(p);
    }
    if (action === "bookmark" || action === "follow") {
      const { target } = z
        .object({ target: z.string().min(1).max(300) })
        .parse(b);
      const entity = await find(target);
      if (
        !entity ||
        entity.deletedAt ||
        !(
          action === "bookmark" ? ["tournament"] : ["organizer", "athlete"]
        ).includes(entity.kind)
      )
        throw new ApiError("Yozuv topilmadi", 404);
      const id = u.id + ":" + action + ":" + target,
        prev = await find(id);
      await put(id, action, u.id, target, {
        target,
        deletedAt: prev
          ? prev.deletedAt
            ? null
            : new Date().toISOString()
          : null,
      });
      return json({ active: !prev || !!prev.deletedAt });
    }
    if (action === "register") {
      const p = z
        .object({
          slug: z.string().max(200),
          team: z.string().trim().min(2).max(100),
          teamId: z.string().max(300).default(""),
          count: z.number().int().min(1).max(64),
        })
        .parse(b);
      const t = (await list("tournament")).find((t) => t.slug === p.slug);
      if (!t || t.status !== "ochiq")
        throw new ApiError("Turnirga ro‘yxat yopiq", 409);
      if (
        t.registrationDeadline &&
        t.registrationDeadline < new Date().toISOString().slice(0, 10)
      )
        throw new ApiError("Ro‘yxatdan o‘tish muddati tugagan", 409);
      if (p.teamId) {
        const team = await find(p.teamId);
        if (
          !team ||
          team.deletedAt ||
          team.kind !== "team" ||
          team.ownerId !== u.id
        )
          throw new ApiError("Jamoa sizga tegishli emas", 403);
      }
      if (t.format === "solo" && p.count !== 1)
        throw new ApiError("Yakka turnir uchun 1 ishtirokchi tanlang");
      const id = u.id + ":registration:" + t.slug;
      const old = await find(id);
      if (old && !["cancelled", "rejected"].includes(old.status))
        throw new ApiError("Ariza allaqachon yuborilgan", 409);
      const r = {
        ...p,
        tournamentId: t.id,
        tournamentName: t.name,
        status: t.price ? "awaiting_payment" : "pending",
        price: t.price,
        currency: "UZS",
        img: t.img,
        updatedAt: new Date().toISOString(),
      };
      const created = await createRegistrationIfAvailable({id,kind:"registration",owner:u.id,target:t.slug,data:JSON.stringify(r),created_at:new Date().toISOString()}, t.capacity);
      if (!created)
        throw new ApiError(
          "Bo‘sh o‘rin qolmagan yoki ariza avval yuborilgan",
          409,
        );
      return json({ ...r, id });
    }
    if (action === "cancel-registration" || action === "decide-registration") {
      const { id } = z.object({ id: z.string().max(500) }).parse(b);
      const r = await find(id);
      if (!r || r.kind !== "registration" || r.deletedAt)
        throw new ApiError("Ariza topilmadi", 404);
      const t = (await list("tournament")).find((t) => t.slug === r.slug);
      let status = "cancelled";
      if (action === "cancel-registration") {
        if (r.ownerId !== u.id && u.role !== "admin")
          throw new ApiError("Ruxsat yo‘q", 403);
      } else {
        status = z.enum(["confirmed", "rejected"]).parse(b.status);
        if (!t || (t.ownerId !== u.id && u.role !== "admin"))
          throw new ApiError("Tashkilotchi huquqi kerak", 403);
        if (status === "confirmed" && r.price > 0 && r.paymentStatus !== "paid")
          throw new ApiError("Haqiqiy to‘lov tasdiqlanmagan", 409);
      }
      const next = { ...r, status, updatedAt: new Date().toISOString() };
      await writeRecords([
        statement(r.id, "registration", r.ownerId, r.slug, next),
        await audit(u.id, action, r.id, r, next),
      ]);
      return json(next);
    }
    if (action === "review") {
      const p = z
        .object({
          id: z.string().optional(),
          target: z.string().max(300),
          rating: z.number().int().min(1).max(5),
          title: z.string().trim().min(2).max(150),
          text: z.string().trim().min(10).max(3000),
        })
        .parse(b);
      const target = await find(p.target);
      if (
        !target ||
        target.deletedAt ||
        !["tournament", "organizer"].includes(target.kind)
      )
        throw new ApiError("Sharh uchun obyekt topilmadi");
      if (target.ownerId === u.id)
        throw new ApiError("O‘z profilingizga sharh qoldira olmaysiz");
      const id = u.id + ":review:" + p.target;
      const prev = await find(id);
      const r = {
        ...p,
        name: u.name,
        who: u.name,
        image: u.image,
        rating: p.rating,
        status: "pending",
        updatedAt: new Date().toISOString(),
      };
      await writeRecords([
        statement(id, "review", u.id, p.target, r),
        await audit(
          u.id,
          prev ? "update-review" : "create-review",
          id,
          prev,
          r,
        ),
      ]);
      return json(r);
    }
    if (action === "message" || action === "contact") {
      const p = z
        .object({
          target: z.string().max(300).default("KiGo"),
          name: z.string().max(100).default(u.name),
          phone: z.string().max(30).default(""),
          text: z.string().trim().min(5).max(5000),
          category: z
            .enum(["message", "advertising", "support", "invitation", "report"])
            .default("support"),
        })
        .parse(b);
      const target = await find(p.target);
      const recipientId = target?.ownerId || "";
      const id = crypto.randomUUID();
      await put(id, action, u.id, p.target, {
        ...p,
        senderName: u.name,
        senderEmail: u.email,
        recipientId,
        status: "new",
        updatedAt: new Date().toISOString(),
      });
      return json({ id, saved: true });
    }
    if (action === "message-reply") {
      const p = z
        .object({ id: z.string(), text: z.string().trim().min(2).max(5000) })
        .parse(b);
      const original = await find(p.id);
      if (!original || !["message", "contact"].includes(original.kind))
        throw new ApiError("Xabar topilmadi", 404);
      if (u.role !== "admin" && original.recipientId !== u.id)
        throw new ApiError("Ruxsat yo‘q", 403);
      const id = crypto.randomUUID();
      await writeRecords([
        statement(id, "message", u.id, original.ownerId, {
          text: p.text,
          senderName: u.name,
          recipientId: original.ownerId,
          status: "new",
          category: "message",
          threadId: original.id,
          updatedAt: new Date().toISOString(),
        }),
        statement(
          original.id,
          original.kind,
          original.ownerId,
          original.target || "",
          { ...original, status: "replied" },
        ),
      ]);
      return json({ id });
    }
    if (action === "match") {
      const p = z
        .object({
          id: z.string().optional(),
          slug: z.string().max(200),
          home: z.string().trim().min(1).max(100),
          away: z.string().trim().min(1).max(100),
          homeId: z.string().max(300).default(""),
          awayId: z.string().max(300).default(""),
          homeScore: z.number().int().min(0).max(999),
          awayScore: z.number().int().min(0).max(999),
          round: z.string().min(1).max(80),
          scheduledAt: z.string().max(30).default(""),
          status: z.enum(["scheduled", "live", "finished"]),
        })
        .parse(b);
      const t = (await list("tournament")).find((t) => t.slug === p.slug);
      if (!t || (t.ownerId !== u.id && u.role !== "admin"))
        throw new ApiError("Tashkilotchi huquqi kerak", 403);
      if (p.home === p.away || (p.homeId && p.homeId === p.awayId))
        throw new ApiError("Ikki xil raqib tanlang");
      const prev = p.id ? await find(p.id) : null;
      if (p.id && (!prev || prev.kind !== "match" || prev.slug !== p.slug))
        throw new ApiError("O‘yin topilmadi", 404);
      const ids = [p.homeId, p.awayId].filter(Boolean);
      for (const id of ids) {
        const e = await find(id);
        if (!e || e.deletedAt || !["team", "athlete"].includes(e.kind))
          throw new ApiError("Raqib profili topilmadi");
      }
      const home = p.homeId ? await find(p.homeId) : null,
        away = p.awayId ? await find(p.awayId) : null;
      const id = p.id || crypto.randomUUID();
      const r = {
        ...p,
        home: home?.name || p.home,
        away: away?.name || p.away,
        homePlayers:
          prev?.homePlayers ||
          home?.players ||
          (home?.kind === "athlete" ? [home.id] : []),
        awayPlayers:
          prev?.awayPlayers ||
          away?.players ||
          (away?.kind === "athlete" ? [away.id] : []),
        updatedAt: new Date().toISOString(),
      };
      await writeRecords([
        statement(id, "match", t.ownerId, p.slug, r),
        await audit(u.id, prev ? "update-match" : "create-match", id, prev, r),
      ]);
      return json({ ...r, id });
    }
    if (action === "draw") {
      const { slug } = z.object({ slug: z.string().max(200) }).parse(b);
      const t = (await list("tournament")).find((t) => t.slug === slug);
      if (!t || (t.ownerId !== u.id && u.role !== "admin"))
        throw new ApiError("Tashkilotchi huquqi kerak", 403);
      if ((await list("match")).some((m) => m.slug === slug))
        throw new ApiError("Jadval mavjud. Takroriy qur’a yaratilmadi.", 409);
      const regs = (await list("registration")).filter(
        (r) => r.slug === slug && r.status === "confirmed",
      );
      if (regs.length < 2)
        throw new ApiError("Kamida 2 ta tasdiqlangan ariza kerak");
      for (let i = regs.length - 1; i > 0; i--) {
        const n = crypto.getRandomValues(new Uint32Array(1))[0];
        const j = n % (i + 1);
        [regs[i], regs[j]] = [regs[j], regs[i]];
      }
      const queries = [];
      for (let i = 0; i + 1 < regs.length; i += 2) {
        const a = regs[i],
          b = regs[i + 1];
        const h = a.teamId ? await find(a.teamId) : null,
          w = b.teamId ? await find(b.teamId) : null;
        queries.push(
          statement(crypto.randomUUID(), "match", t.ownerId, slug, {
            slug,
            home: a.team,
            away: b.team,
            homeId: a.teamId || "",
            awayId: b.teamId || "",
            homePlayers: h?.players || [],
            awayPlayers: w?.players || [],
            homeScore: 0,
            awayScore: 0,
            round: "1-bosqich",
            status: "scheduled",
            updatedAt: new Date().toISOString(),
          }),
        );
      }
      queries.push(
        await audit(u.id, "draw", t.id, null, {
          participants: regs.map((r) => r.team),
          bye: regs.length % 2 ? regs.at(-1)?.team : null,
        }),
      );
      await writeRecords(queries);
      return json({
        created: Math.floor(regs.length / 2),
        bye: regs.length % 2 ? regs.at(-1)?.team : null,
      });
    }
    if (action === "track-ad") {
      const { id, event } = z
        .object({ id: z.string().max(300), event: z.enum(["view", "click"]) })
        .parse(b);
      const ad = await find(id);
      if (!ad || ad.kind !== "ad" || ad.deletedAt || ad.status !== "active")
        throw new ApiError("Reklama faol emas", 404);
      const day = new Date().toISOString().slice(0, 10);
      const eventId = "ad-event:" + id + ":" + event + ":" + u.id + ":" + day;
      await writeRecords([statement(eventId,"ad-event",u.id,id,{event,day},{insertOnly:true})]);
      return json({ ok: true });
    }
    if (action === "delete-account") {
      if (u.isOwner)
        throw new ApiError(
          "Sayt egasining hisobini bu yerda o‘chirib bo‘lmaydi.",
          409,
        );
      await put("account:" + u.id, "account", u.id, "", {
        ...(await find("account:" + u.id)),
        deletedAt: new Date().toISOString(),
      });
      await put("athlete:" + u.id, "athlete", u.id, "", {
        ...(await find("athlete:" + u.id)),
        deletedAt: new Date().toISOString(),
      });
      return json({ deleted: true });
    }
    throw new ApiError("Amal topilmadi", 404);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request:Request){const response=await handlePOST(request);if(response.ok){try{response.headers.set("X-Kigo-Backup",await automaticBackup())}catch{response.headers.set("X-Kigo-Backup","failed")}}return response}
