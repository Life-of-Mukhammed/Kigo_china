import { env } from "cloudflare:workers";
import { getAppUser } from "@/lib/app-auth";
import { z } from "zod";
import { findRecord, listRecords, recordWrite, writeRecords, type RecordWrite } from "@/lib/record-store";
// Entity fields vary by `kind`; each write is validated with that kind's Zod schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Entity = Record<string, any>;
export type Row = {
  id: string;
  kind: string;
  owner: string;
  target: string;
  data: string;
  created_at: string;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const decode = (r: Row): Entity => ({
  ...JSON.parse(r.data),
  id: r.id,
  kind: r.kind,
  ownerId: r.owner,
  createdAt: r.created_at,
});
export async function list(
  kind: string,
  owner?: string,
  archived = false,
): Promise<Entity[]> {
  return (await listRecords(kind))
    .filter((row) => !owner || row.owner === owner)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 2000)
    .map(decode)
    .filter((x) => archived || !x.deletedAt);
}
export async function find(id: string) {
  const r = await findRecord(id);
  return r ? decode(r) : null;
}
export function statement(
  id: string,
  kind: string,
  owner: string,
  target: string,
  data: Entity,
  options: Omit<RecordWrite, "record"> = {},
): RecordWrite {
  return recordWrite(id, kind, owner, target, data, options);
}
export async function put(
  id: string,
  kind: string,
  owner: string,
  target: string,
  data: Entity,
) {
  await writeRecords([statement(id, kind, owner, target, data)]);
}
export function clean(e: Entity): Entity {
  const result = { ...e };
  delete result.ownerId;
  delete result.kind;
  return result;
}
export const isOwnerEmail = (email: string) =>
  ((env as unknown as { KIGO_ADMIN_EMAILS?: string }).KIGO_ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .includes(email.toLowerCase());
export async function identity(create = false) {
  const auth = await getAppUser();
  if (!auth) return null;
  const account = await find("account:" + auth.userId);
  const profile = await find("profile:" + auth.userId);
  if (account?.status === "suspended" || account?.deletedAt)
    throw new ApiError(
      "Hisobingiz faol emas. Administratorga murojaat qiling.",
      403,
    );
  const ownerEmail = auth.provider !== "password" && isOwnerEmail(auth.email);
  const role = ownerEmail ? "admin" : account?.role || "user";
  const user = {
    id: auth.userId,
    email: auth.email,
    name: profile?.name || account?.name || auth.displayName,
    phone: profile?.phone || account?.phone || "",
    city: profile?.city || account?.city || "",
    sport: profile?.sport || account?.sport || "",
    image: profile?.image || account?.image || "",
    bio: profile?.bio || "",
    team: profile?.team || "",
    role,
    authProvider: auth.provider || "chatgpt",
    isOwner: ownerEmail,
    notifications: profile?.notifications || {},
    onboarded: !!profile?.onboarded,
  };
  if (create && !account)
    await put("account:" + auth.userId, "account", auth.userId, "", {
      name: user.name,
      email: user.email,
      role: ownerEmail ? "admin" : "user",
      status: "active",
      joinedAt: new Date().toISOString(),
    });
  return user;
}
export async function required() {
  const u = await identity(true);
  if (!u) throw new ApiError("Avval hisobingizga kiring", 401);
  return u;
}
export async function admin() {
  const u = await required();
  if (u.role !== "admin")
    throw new ApiError("Bu amal uchun admin huquqi kerak", 403);
  return u;
}
export async function audit(
  userId: string,
  action: string,
  entityId: string,
  before: Entity | null,
  after: Entity | null,
  onlyIfChanged = false,
) {
  const id = crypto.randomUUID();
  const payload = {
    action,
    entityId,
    before,
    after,
    at: new Date().toISOString(),
  };
  if (onlyIfChanged)
    return recordWrite(id, "audit", userId, entityId, payload, { onlyIfChanged: true });
  return statement(id, "audit", userId, entityId, payload);
}
export function safeImage(s: string) {
  return /^\/(?:media\/|assets\/|api\/files\/)[a-zA-Z0-9_/.?=-]+$/.test(s);
}
const image = z
  .string()
  .max(400)
  .refine(
    (v) => v === "" || safeImage(v),
    "Rasmni media kutubxonasidan tanlang",
  );
const link = z
  .string()
  .max(500)
  .refine(
    (v) => !v || /^\/(?!\/)/.test(v) || /^https?:\/\//i.test(v),
    "Havola / yoki https:// bilan boshlansin",
  );
const date = z
  .string()
  .max(10)
  .refine(
    (v) =>
      !v ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v),
    "Sana noto‘g‘ri",
  );
const base = {
  id: z.string().max(300).optional(),
  name: z.string().trim().min(2).max(150),
};
export const schemas = {
  tournament: z.object({
    ...base,
    sport: z.string().min(2).max(60),
    description: z.string().max(10000).default(""),
    city: z.string().min(2).max(80),
    address: z.string().max(300).default(""),
    startDate: date.default(""),
    endDate: date.default(""),
    registrationDeadline: date.default(""),
    capacity: z.number().int().min(2).max(512),
    format: z.enum(["team", "solo"]),
    price: z.number().int().min(0).max(100000000),
    prize: z.string().max(150).default(""),
    img: image.default(""),
    organizerId: z.string().max(300).default(""),
    rules: z.string().max(15000).default(""),
    status: z.enum(["draft", "ochiq", "jonli", "tugagan", "bekor"]),
    ownerId: z.string().optional(),
  }),
  organizer: z.object({
    ...base,
    city: z.string().max(80),
    sport: z.string().max(60),
    description: z.string().max(10000).default(""),
    image: image.default(""),
    phone: z.string().max(30).default(""),
    email: z.string().email().or(z.literal("")).default(""),
    website: link.default(""),
    verified: z.boolean().default(false),
    ownerId: z.string().optional(),
  }),
  athlete: z.object({
    ...base,
    city: z.string().max(80).default(""),
    sport: z.string().max(60).default(""),
    bio: z.string().max(3000).default(""),
    image: image.default(""),
    userId: z.string().max(300).default(""),
  }),
  team: z.object({
    ...base,
    city: z.string().max(80),
    sport: z.string().max(60),
    image: image.default(""),
    players: z.array(z.string().max(300)).max(64).default([]),
  }),
  ad: z.object({
    ...base,
    title: z.string().min(2).max(150),
    subtitle: z.string().max(400).default(""),
    image: image.refine(Boolean, "Reklama rasmi kerak"),
    url: link.refine(Boolean, "Reklama havolasi kerak"),
    buttonLabel: z.string().max(40).default("Batafsil"),
    slot: z.enum(["hero", "banner", "sidebar"]),
    status: z.enum(["draft", "active", "paused"]),
    startDate: date.default(""),
    endDate: date.default(""),
    priority: z.number().int().min(0).max(100).default(0),
  }),
  sponsor: z.object({
    ...base,
    image: image.default(""),
    url: link.default(""),
    active: z.boolean().default(true),
  }),
  settings: z.object({
    name: z.string().min(2).max(150),
    tagline: z.string().max(250),
    heroTitle: z.string().max(200),
    heroSubtitle: z.string().max(700),
    heroImage: image,
    about: z.string().max(12000),
    contactEmail: z.string().email().or(z.literal("")),
    contactPhone: z.string().max(30),
    telegram: link,
    instagram: link,
    terms: z.string().max(30000),
    privacy: z.string().max(30000),
    winPoints: z.number().int().min(0).max(10).default(3),
    drawPoints: z.number().int().min(0).max(10).default(1),
  }),
};
export type ManagedKind = keyof typeof schemas;
export const defaults = {
  name: "KiGo",
  tagline: "Sport turnirlari. Bir platforma. Bitta hamjamiyat.",
  heroTitle: "Turnirlar o‘tkaz, sportchilarni birlashtir!",
  heroSubtitle:
    "Turnir toping, jamoangizni ro‘yxatdan o‘tkazing va natijalarni bir joyda kuzating.",
  heroImage: "/media/hero.webp",
  about:
    "KiGo — sport musobaqalarini tashkil qilish, ro‘yxatdan o‘tish va natijalarni boshqarish platformasi.",
  contactEmail: "",
  contactPhone: "",
  telegram: "",
  instagram: "",
  terms: "",
  privacy: "",
  winPoints: 3,
  drawPoints: 1,
};
export async function settings() {
  return { ...defaults, ...((await find("settings:site")) || {}) };
}
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "kigo";
export function published(t: Entity) {
  return !t.deletedAt && t.status !== "draft";
}
export function tournamentView(t: Entity, regs: Entity[]): Entity {
  const count = regs.filter(
    (r) => r.slug === t.slug && !["cancelled", "rejected"].includes(r.status),
  ).length;
  return {
    ...clean(t),
    href: "/turnirlar/" + t.slug,
    pay: t.price ? "Pullik" : "Bepul",
    loc: [t.address, t.city].filter(Boolean).join(", "),
    date: [t.startDate, t.endDate].filter(Boolean).join(" — "),
    registered: count,
    cnt:
      count + "/" + t.capacity + (t.format === "team" ? " jamoa" : " sportchi"),
    stl: (
      {
        ochiq: "Ro‘yxat ochiq",
        jonli: "Jonli",
        tugagan: "Yakunlangan",
        bekor: "Bekor qilingan",
        draft: "Qoralama",
      } as Entity
    )[t.status],
  };
}
export async function standings() {
  const [matches, teams, athletes, s] = await Promise.all([
    list("match"),
    list("team"),
    list("athlete"),
    settings(),
  ]);
  const ranks = (kind: "team" | "athlete", items: Entity[]) =>
    items
      .map((item): Entity => {
        const relevant = matches.filter(
          (m) =>
            m.status === "finished" &&
            (kind === "team"
              ? m.homeId === item.id || m.awayId === item.id
              : (m.homePlayers || []).includes(item.id) ||
                (m.awayPlayers || []).includes(item.id) ||
                m.homeId === item.id ||
                m.awayId === item.id),
        );
        let wins = 0,
          draws = 0,
          losses = 0;
        for (const m of relevant) {
          const home =
            kind === "team"
              ? m.homeId === item.id
              : m.homeId === item.id || (m.homePlayers || []).includes(item.id);
          const a = home ? m.homeScore : m.awayScore,
            b = home ? m.awayScore : m.homeScore;
          if (a > b) wins++;
          else if (a === b) draws++;
          else losses++;
        }
        return {
          ...clean(item),
          matches: relevant.length,
          wins,
          draws,
          losses,
          points: wins * s.winPoints + draws * s.drawPoints,
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.wins - a.wins ||
          a.name.localeCompare(b.name),
      );
  return { teams: ranks("team", teams), athletes: ranks("athlete", athletes) };
}
