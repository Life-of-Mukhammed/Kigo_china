import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
const sql = new DatabaseSync(":memory:");
sql.exec(await readFile("drizzle/0000_chunky_titania.sql", "utf8"));
class Prepared {
  constructor(query, args = []) {
    this.query = query;
    this.args = args;
  }
  bind(...args) {
    return new Prepared(this.query, args);
  }
  async first() {
    return sql.prepare(this.query).get(...this.args) || null;
  }
  async all() {
    return { results: sql.prepare(this.query).all(...this.args) };
  }
  async run() {
    const r = sql.prepare(this.query).run(...this.args);
    return { meta: { changes: Number(r.changes) } };
  }
}
const files = new Map();
let transactionQueue = Promise.resolve();
globalThis.__KIGO_TEST_ENV = {
  DB: {
    prepare: (q) => new Prepared(q),
    async batch(stmts) {
      const next = transactionQueue.then(async () => {
        sql.exec("BEGIN");
        try {
          const results = [];
          for (const s of stmts) results.push(await s.run());
          sql.exec("COMMIT");
          return results;
        } catch (e) {
          sql.exec("ROLLBACK");
          throw e;
        }
      });
      transactionQueue = next.catch(() => {});
      return next;
    },
  },
  BUCKET: {
    async put(id, data, options) {
      files.set(id, { body: data, httpMetadata: options.httpMetadata });
    },
    async get(id) {
      const f=files.get(id);if(!f)return null;return {...f,size:typeof f.body==='string'?f.body.length:f.body.byteLength,text:async()=>typeof f.body==='string'?f.body:new TextDecoder().decode(f.body)};
    },
  },
  KIGO_ADMIN_EMAILS: "owner@example.test",
};
globalThis.__KIGO_TEST_USER = null;
await mkdir("outputs", { recursive: true });
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {GET,POST} from './app/api/kigo/route';export {GET as adminGet,POST as adminPost} from './app/api/admin/route';export {POST as upload} from './app/api/upload/route';export {GET as backupGet,POST as backupPost} from './app/api/backups/route';export {automaticBackup} from './lib/backups';`,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "outputs/domain-test.mjs",
  packages: "external",
  plugins: [
    {
      name: "test-boundaries",
      setup(b) {
        b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({
          path: "env",
          namespace: "test-env",
        }));
        b.onLoad({ filter: /.*/, namespace: "test-env" }, () => ({
          contents: "export const env=globalThis.__KIGO_TEST_ENV;",
        }));
        b.onResolve({ filter: /(?:chatgpt-auth|app-auth)/ }, () => ({
          path: "auth",
          namespace: "test-auth",
        }));
        b.onLoad({ filter: /.*/, namespace: "test-auth" }, () => ({
          contents:
            "export async function getChatGPTUser(){return globalThis.__KIGO_TEST_USER;} export const getAppUser=getChatGPTUser;export const googleReady=()=>false;",
        }));
      },
    },
  ],
});
const api = await import(
  pathToFileURL(process.cwd() + "/outputs/domain-test.mjs")
);
const actors = {
  admin: { userId: "owner", email: "owner@example.test", displayName: "Owner" },
  a: { userId: "member-a", email: "a@example.test", displayName: "Sportchi A" },
  b: { userId: "member-b", email: "b@example.test", displayName: "Sportchi B" },
  c: { userId: "member-c", email: "c@example.test", displayName: "Sportchi C" },
};
let checks = 0;
async function call(actor, action, body = {}, method = "POST", admin = false) {
  globalThis.__KIGO_TEST_USER = actors[actor] || null;
  const r =
    method === "GET"
      ? await api[admin ? "adminGet" : "GET"](
          new Request(
            "https://test.local/api/" +
              (admin ? "admin" : "kigo") +
              "?action=" +
              action +
              "&" +
              new URLSearchParams(body),
          ),
        )
      : await api[admin ? "adminPost" : "POST"](
          new Request("https://test.local/api/" + (admin ? "admin" : "kigo"), {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "https://test.local",
            },
            body: JSON.stringify({ action, ...body }),
          }),
        );
  return { status: r.status, data: await r.json() };
}
function equal(a, b) {
  checks++;
  assert.equal(a, b);
}
function ok(v) {
  checks++;
  assert.ok(v);
}
const get = (actor, action = "bootstrap", params = {}) =>
  call(actor, action, params, "GET");
const post = (actor, action, data) => call(actor, action, data);
async function entity(actor, kind, data) {
  const r = await post(actor, "entity-save", { kind, data });
  equal(r.status, 200);
  return r.data;
}
const baseTour = {
  name: "Audit Cup",
  sport: "Futbol",
  description: "Actual integration fixture",
  city: "Toshkent",
  address: "Test arena",
  startDate: "2027-01-10",
  endDate: "2027-01-12",
  registrationDeadline: "2027-01-09",
  capacity: 2,
  format: "team",
  price: 0,
  prize: "Kubok",
  img: "/media/football.webp",
  rules: "Fair play",
  status: "ochiq",
};
equal((await post(null, "entity-save", { kind: "ad", data: {} })).status, 401);
for (const who of ["a", "b", "admin"]) equal((await get(who)).status, 200);
equal((await call("a", "", { kind: "overview" }, "GET", true)).status, 403);
equal((await post("a", "entity-save", { kind: "ad", data: {} })).status, 403);
equal(
  (await post("admin", "entity-save", { kind: "__proto__", data: {} })).status,
  400,
);
let b = await get("admin");
equal(b.data.tournaments.length, 0);
equal(b.data.stats.registeredUsers, 3);
equal(b.data.stats.completedTournaments, 0);
const org = await entity("admin", "organizer", {
  name: "Audit Sport",
  city: "Toshkent",
  sport: "Futbol",
  description: "Real test organization",
  image: "",
  phone: "",
  email: "",
  website: "",
  verified: true,
});
equal(
  (
    await post("a", "entity-save", {
      kind: "organizer",
      data: { ...org, name: "Unauthorized change" },
    })
  ).status,
  403,
);
for (const who of ["a", "b"])
  equal(
    (
      await post(who, "profile", {
        name: "Sportchi " + who,
        phone: "",
        city: "Toshkent",
        sport: "Futbol",
        bio: "",
        image: "",
        notifications: {},
      })
    ).status,
    200,
  );
const ta = await entity("a", "team", {
  name: "Team A",
  city: "Toshkent",
  sport: "Futbol",
  image: "",
  players: ["athlete:member-a"],
});
const tb = await entity("b", "team", {
  name: "Team B",
  city: "Toshkent",
  sport: "Futbol",
  image: "",
  players: ["athlete:member-b"],
});
equal(
  (
    await post("admin", "entity-save", {
      kind: "tournament",
      data: { ...baseTour, organizerId: org.id, endDate: "2026-01-01" },
    })
  ).status,
  400,
);
const tour = await entity("admin", "tournament", {
  ...baseTour,
  organizerId: org.id,
});
const updated = await post("admin", "entity-save", {
  kind: "tournament",
  data: { ...tour, description: "Edited description" },
  expectedUpdatedAt: tour.updatedAt,
});
equal(updated.status, 200);
equal(
  (
    await post("admin", "entity-save", {
      kind: "tournament",
      data: { ...tour, description: "Stale edit" },
      expectedUpdatedAt: "stale",
    })
  ).status,
  409,
);
const aReg = await post("a", "register", {
  slug: tour.slug,
  team: "Team A",
  teamId: ta.id,
  count: 8,
});
equal(aReg.status, 200);
equal(
  (
    await post("a", "register", {
      slug: tour.slug,
      team: "Team A",
      teamId: ta.id,
      count: 8,
    })
  ).status,
  409,
);
const bReg = await post("b", "register", {
  slug: tour.slug,
  team: "Team B",
  teamId: tb.id,
  count: 8,
});
equal(bReg.status, 200);
equal(
  (await post("c", "register", { slug: tour.slug, team: "Team C", count: 8 }))
    .status,
  409,
);
equal(
  (await post("b", "cancel-registration", { id: aReg.data.id })).status,
  403,
);
equal(
  (
    await post("a", "decide-registration", {
      id: bReg.data.id,
      status: "confirmed",
    })
  ).status,
  403,
);
for (const id of [aReg.data.id, bReg.data.id])
  equal(
    (await post("admin", "decide-registration", { id, status: "confirmed" }))
      .status,
    200,
  );
equal((await post("a", "draw", { slug: tour.slug })).status, 403);
equal((await post("admin", "draw", { slug: tour.slug })).data.created, 1);
equal((await post("admin", "draw", { slug: tour.slug })).status, 409);
const detail = await get("admin", "tournament", { slug: tour.slug });
const match = detail.data.matches[0];
equal(detail.data.isOwner, true);
equal(
  (await get("a", "tournament", { slug: tour.slug })).data.participants[0]
    .ownerId,
  undefined,
);
equal(
  (
    await post("a", "match", {
      ...match,
      status: "finished",
      homeScore: 2,
      awayScore: 0,
    })
  ).status,
  403,
);
equal(
  (
    await post("admin", "match", {
      ...match,
      status: "finished",
      homeScore: 2,
      awayScore: 0,
    })
  ).status,
  200,
);
b = await get("a");
equal(
  b.data.teams.reduce((n, t) => n + t.points, 0),
  3,
);
equal(
  b.data.athletes.reduce((n, t) => n + t.wins, 0),
  1,
);
equal(
  (
    await post("admin", "review", {
      target: org.id,
      rating: 5,
      title: "Own review",
      text: "Self review denied",
    })
  ).status,
  400,
);
equal(
  (
    await post("a", "review", {
      target: org.id,
      rating: 6,
      title: "Invalid",
      text: "Invalid rating denied",
    })
  ).status,
  400,
);
equal(
  (
    await post("a", "review", {
      target: org.id,
      rating: 5,
      title: "Excellent",
      text: "Actual review content",
    })
  ).status,
  200,
);
equal((await get("a")).data.reviews.length, 0);
const reviewId = "member-a:review:" + org.id;
equal(
  (
    await call(
      "a",
      "moderate",
      { id: reviewId, status: "approved" },
      "POST",
      true,
    )
  ).status,
  403,
);
equal(
  (
    await call(
      "admin",
      "moderate",
      { id: reviewId, status: "approved" },
      "POST",
      true,
    )
  ).status,
  200,
);
b = await get("a");
equal(b.data.reviews.length, 1);
equal(b.data.organizers[0].rating, 5);
equal((await post("a", "follow", { target: org.id })).data.active, true);
equal((await get("a")).data.follows.length, 1);
equal((await post("a", "follow", { target: org.id })).data.active, false);
equal((await post("a", "bookmark", { target: tour.id })).data.active, true);
equal((await get("a")).data.bookmarks.length, 1);
const ad = await entity("admin", "ad", {
  name: "Audit campaign",
  title: "Sport campaign",
  subtitle: "Real",
  image: "/media/football.webp",
  url: "/turnirlar",
  buttonLabel: "Batafsil",
  slot: "hero",
  status: "active",
  startDate: "",
  endDate: "",
  priority: 1,
});
const future = await entity("admin", "ad", {
  ...ad,
  id: undefined,
  name: "Scheduled campaign",
  startDate: "2099-01-01",
});
equal((await get("a")).data.ads.length, 1);
for (const event of ["view", "view", "click", "click"])
  equal((await post("a", "track-ad", { id: ad.id, event })).status, 200);
const overview = await call("admin", "", { kind: "overview" }, "GET", true);
equal(
  overview.data.adStats
    .filter((a) => a.target === ad.id)
    .reduce((n, a) => n + a.n, 0),
  2,
);
equal(
  (
    await post("admin", "entity-save", {
      kind: "ad",
      data: { ...ad, url: "javascript:alert(1)" },
    })
  ).status,
  400,
);
const ticket = await post("a", "contact", {
  text: "Need advertising information",
  category: "advertising",
});
equal(ticket.status, 200);
equal(
  (
    await post("b", "message-reply", {
      id: ticket.data.id,
      text: "Unauthorized reply",
    })
  ).status,
  403,
);
equal(
  (
    await post("admin", "message-reply", {
      id: ticket.data.id,
      text: "Here are the details",
    })
  ).status,
  200,
);
ok(
  (await get("a")).data.messages.some((m) => m.text === "Here are the details"),
);
equal((await get("b")).data.messages.length, 0);
equal((await post("b", "entity-delete", { id: tour.id })).status, 403);
equal((await post("admin", "entity-delete", { id: future.id })).status, 200);
equal(
  (await call("admin", "", { kind: "ad", archived: "1" }, "GET", true)).data
    .total,
  1,
);
equal((await post("admin", "entity-restore", { id: future.id })).status, 200);
equal(
  (
    await call(
      "a",
      "user-update",
      { id: "account:member-b", role: "admin" },
      "POST",
      true,
    )
  ).status,
  403,
);
equal(
  (
    await call(
      "admin",
      "user-update",
      { id: "account:owner", status: "suspended" },
      "POST",
      true,
    )
  ).status,
  400,
);
equal(
  (
    await call(
      "admin",
      "user-update",
      { id: "account:member-b", status: "suspended" },
      "POST",
      true,
    )
  ).status,
  200,
);
equal((await get("b")).status, 403);
equal(
  (
    await call(
      "admin",
      "user-update",
      { id: "account:member-b", status: "active" },
      "POST",
      true,
    )
  ).status,
  200,
);
const badOrigin = new Request("https://test.local/api/kigo", {
  method: "POST",
  headers: { origin: "https://evil.test" },
  body: JSON.stringify({ action: "contact", text: "bad origin" }),
});
equal((await api.POST(badOrigin)).status, 403);
globalThis.__KIGO_TEST_USER = actors.admin;
const form = new FormData();
form.append(
  "file",
  new File(["not-an-image"], "bad.png", { type: "image/png" }),
);
equal(
  (
    await api.upload(
      new Request("https://test.local/api/upload", {
        method: "POST",
        body: form,
      }),
    )
  ).status,
  400,
);
const image = await readFile("public/assets/bca122512fa5256bed436ae228fecea1");
const valid = new FormData();
valid.append("file", new File([image], "logo.png", { type: "image/png" }));
const uploaded = await api.upload(
  new Request("https://test.local/api/upload", { method: "POST", body: valid }),
);
equal(uploaded.status, 200);
ok([...files.keys()].filter(k=>!k.startsWith("backups/")).length === 1);
equal((await call("admin", "", { kind: "audit" }, "GET", true)).status, 200);
ok((await call("admin", "", { kind: "audit" }, "GET", true)).data.total > 10);
// Regression checks for conflicting editors, linked media and account-owner safety.
equal(
  (
    await post("admin", "entity-save", {
      kind: "tournament",
      data: {
        ...baseTour,
        organizerId: org.id,
        startDate: "2027-02-30",
        endDate: "2027-03-03",
      },
    })
  ).status,
  400,
);
const current = (await get("admin", "tournament", { slug: tour.slug })).data
  .tournament;
const competing = await Promise.all(
  ["First editor", "Second editor"].map((description) =>
    post("admin", "entity-save", {
      kind: "tournament",
      data: { ...current, description },
      expectedUpdatedAt: current.updatedAt,
    }),
  ),
);
equal(competing.filter((r) => r.status === 200).length, 1);
equal(competing.filter((r) => r.status === 409).length, 1);
equal((await post("admin", "entity-delete", { id: org.id })).status, 409);
const media = await uploaded.json();
const linked = await entity("admin", "ad", {
  ...ad,
  id: undefined,
  name: "Uploaded banner",
  image: media.url,
});
equal((await post("admin", "entity-delete", { id: media.id })).status, 409);
equal((await post("admin", "entity-delete", { id: linked.id })).status, 200);
equal((await post("admin", "entity-delete", { id: media.id })).status, 200);
equal((await post("admin", "delete-account", {})).status, 409);
// Snapshot recovery uses real SQLite transactions and a separate R2 boundary.
async function backup(actor,body,params='') {
 globalThis.__KIGO_TEST_USER=actors[actor]||null;
 return body?api.backupPost(new Request('https://test.local/api/backups',{method:'POST',headers:{origin:'https://test.local'},body:JSON.stringify(body)})):api.backupGet(new Request('https://test.local/api/backups'+params));
}
equal((await backup('a')).status,403);
equal((await backup(null)).status,401);
const saved=await (await backup('admin',{action:'create'})).json();
ok(saved.key.startsWith('backups/v1/'));
const snapshot=await (await backup('admin',null,'?id='+saved.id)).json();
ok(snapshot.records.length>0);
ok(!snapshot.records.some(r=>['auth-session','auth-attempt','backup','system','rate'].includes(r.kind)));
const recovery=snapshot.records.find(r=>r.kind==='tournament');
const original=recovery.data;
sql.prepare('DELETE FROM records WHERE id=?').run(recovery.id);
const preview=await (await backup('admin',null,'?id='+saved.id+'&preview=1')).json();
ok(preview.missingIds.includes(recovery.id));
equal((await backup('admin',{action:'restore',id:saved.id,ids:[recovery.id]})).status,400);
const restored=await (await backup('admin',{action:'restore',id:saved.id,ids:[recovery.id],confirm:'TIKLASH'})).json();
equal(restored.restored,1);
ok(restored.safetyBackupId);
equal(sql.prepare('SELECT data FROM records WHERE id=?').get(recovery.id).data,original);
sql.prepare('UPDATE records SET data=? WHERE id=?').run(JSON.stringify({newer:true}),recovery.id);
equal((await (await backup('admin',{action:'restore',id:saved.id,ids:[recovery.id],confirm:'TIKLASH'})).json()).restored,0);
equal((await (await backup('admin',{action:'restore',id:saved.id,ids:[recovery.id],mode:'replace',confirm:'TIKLASH'})).json()).restored,1);
equal(sql.prepare('SELECT data FROM records WHERE id=?').get(recovery.id).data,original);
sql.prepare("INSERT INTO records VALUES('post-snapshot','news','owner','', '{}',?)").run(new Date().toISOString());
await backup('admin',{action:'restore',id:saved.id,ids:[recovery.id],mode:'replace',confirm:'TIKLASH'});
ok(sql.prepare("SELECT id FROM records WHERE id='post-snapshot'").get());
const obj=files.get(saved.key);const intact=obj.body;obj.body=intact.replace('"version":1','"version":2');
equal((await backup('admin',null,'?id='+saved.id)).status,400);obj.body=intact;
equal(await api.automaticBackup(),'recent');
console.log(
  `PASS ${checks} assertions: real SQLite CRUD, ownership, admin roles, signup/profile, real counts, capacity and duplicates, approvals, draw, result-derived rankings, moderation, scheduled ads and deduplicated analytics, replies, archive/restore, suspension, image upload and origin protection.`,
);
