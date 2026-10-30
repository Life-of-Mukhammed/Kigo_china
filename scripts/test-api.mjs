// Real dev-server checks. Run only against loopback; domain fixtures use in-memory SQLite.
import assert from "node:assert/strict";
const base = process.env.KIGO_TEST_URL || "http://127.0.0.1:3000";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(base).hostname),
  "Local-only tests",
);
const cookie = "__sites_local_auth=1";
const send = async (action, p = {}, auth = true) => {
  const r = await fetch(base + "/api/kigo", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { cookie } : {}),
    },
    body: JSON.stringify({ action, ...p }),
  });
  return { status: r.status, data: await r.json() };
};
assert.equal((await send("follow", { target: "bad" }, false)).status, 401);
const spoof = await fetch(base + "/api/kigo?action=bootstrap", {
  headers: {
    "oai-authenticated-user-id": "forged",
    "oai-authenticated-user-email": "forged@example.com",
  },
});
assert.equal((await spoof.json()).user, null);
assert.equal((await fetch(base + "/api/admin?kind=overview")).status, 401);
const auth = await fetch(base + "/api/admin?kind=overview", {
  headers: { cookie },
});
assert.equal(auth.status, 200);
const bootstrap = await (
  await fetch(base + "/api/kigo?action=bootstrap", { headers: { cookie } })
).json();
assert.equal(bootstrap.user.role, "admin");
assert.ok(!bootstrap.tournaments.some((t) => t.id.startsWith("seed-")));
// Archive only the old fixtures created by the earlier local integration tests.
for (const kind of [
  "tournament",
  "registration",
  "match",
  "review",
  "message",
]) {
  const r = await fetch(base + "/api/admin?kind=" + kind + "&q=QA", {
    headers: { cookie },
  });
  const body = await r.json();
  for (const e of body.items || [])
    if (
      e.ownerId === "local_seedy" &&
      (/^QA \d{13}$/.test(e.name || "") ||
        /^QA \d{13}$/.test(e.tournamentName || "") ||
        /^qa-\d{13}-/.test(e.slug || "") ||
        /^QA \d{13}$/.test(e.target || ""))
    ) {
      const result = await send("entity-delete", { id: e.id });
      assert.equal(result.status, 200);
    }
}
for (const path of [
  "/",
  "/login",
  "/register",
  "/profil",
  "/turnirlar",
  "/sportchilar",
  "/tashkilotchilar",
  "/turnir-yaratish",
  "/tashkilotchi-yaratish",
  "/jamoa-yaratish",
  "/natijalar",
  "/hamkorlik",
  "/biz-haqimizda",
  "/shartlar",
  "/admin",
]) {
  const r = await fetch(base + path, { headers: { cookie } });
  assert.equal(r.status, 200, path);
}
assert.equal((await fetch(base + "/does-not-exist")).status, 404);
const qr = await fetch(base + "/api/qr?path=%2F");
assert.ok((await qr.text()).includes("<svg"));
const frame = await fetch(base + "/api/qr?path=%2F%2Fevil.test");
assert.equal(frame.status, 400);
console.log(
  "PASS: loopback HTTP auth, header spoof protection, admin guard, no seed records, local legacy-fixture archive, 15 routes, genuine 404, QR generation and redirect validation.",
);
