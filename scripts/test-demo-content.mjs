import assert from "node:assert/strict";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";

const records = new Map();
let writeCount = 0;
globalThis.__demoStore = {
  records,
  async findRecord(id) {
    return records.get(id) || null;
  },
  recordWrite(id, kind, owner, target, data, options = {}) {
    return { record: { id, kind, owner, target, data: JSON.stringify(data) }, ...options };
  },
  async writeRecords(writes) {
    writeCount += writes.length;
    return writes.map((write) => {
      if (write.insertOnly && records.has(write.record.id)) return 0;
      records.set(write.record.id, write.record);
      return 1;
    });
  },
  async removeRecord(id, kind) {
    if (records.get(id)?.kind !== kind) return 0;
    records.delete(id);
    return 1;
  },
};

await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {ensureDemoContent} from './lib/demo-content';`,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "outputs/demo-content-test.mjs",
  plugins: [{
    name: "mock-record-store",
    setup(builder) {
      builder.onResolve({ filter: /^@\/lib\/record-store$/ }, () => ({ path: "mock-store", namespace: "mock-store" }));
      builder.onLoad({ filter: /.*/, namespace: "mock-store" }, () => ({
        contents: `const s=globalThis.__demoStore;export const findRecord=s.findRecord;export const recordWrite=s.recordWrite;export const writeRecords=s.writeRecords;export const removeRecord=s.removeRecord;`,
        loader: "js",
      }));
    },
  }],
});

const { ensureDemoContent } = await import(pathToFileURL(`${process.cwd()}/outputs/demo-content-test.mjs`));
delete process.env.VERCEL;
await ensureDemoContent();
assert.equal(records.size, 0, "local and test environments must not seed production demos");

process.env.VERCEL = "1";
for (let i = 1; i <= 5; i++) {
  const id = `demo-ad-${i}`;
  records.set(id, { id, kind: "ad", data: JSON.stringify({ demo: true }) });
}
records.set("system:demo-content-v2", { id: "system:demo-content-v2", kind: "system", data: "{}" });
for (let i = 1; i <= 5; i++) {
  records.set(`demo-tournament-${i}`, {
    id: `demo-tournament-${i}`,
    kind: "tournament",
    data: JSON.stringify({ status: "tugagan", demo: true, img: "/media/football.webp" }),
  });
}
await ensureDemoContent();

const ofKind = (kind) => [...records.values()].filter((row) => row.kind === kind);
assert.equal(ofKind("tournament").length, 10);
assert.equal(ofKind("organizer").length, 5);
assert.equal(ofKind("review").length, 5);
assert.equal(ofKind("ad").length, 1);
assert.equal(JSON.parse(records.get("demo-ad-1").data).demo, true);
assert.ok([2, 3, 4, 5].every((i) => !records.has(`demo-ad-${i}`)));
for (const row of ofKind("tournament")) {
  const tournament = JSON.parse(row.data);
  assert.ok(["tugagan", "ochiq"].includes(tournament.status));
  assert.match(tournament.img, /^\/media\//);
  assert.equal(tournament.demo, true);
}
assert.equal(ofKind("tournament").filter((row) => JSON.parse(row.data).status === "tugagan").length, 5);
assert.equal(ofKind("tournament").filter((row) => JSON.parse(row.data).status === "ochiq").length, 5);
for (const row of ofKind("review")) {
  const review = JSON.parse(row.data);
  assert.equal(review.demo, true);
  assert.match(review.text, /haqiqiy foydalanuvchi sharhi emas/i);
}

const stableCount = records.size;
const stableWrites = writeCount;
await ensureDemoContent();
assert.equal(records.size, stableCount, "seeding must be idempotent");
assert.equal(writeCount, stableWrites, "completed seed must not write on every request");
console.log("PASS: production seed adds five upcoming tournaments to the existing five, is idempotent and Vercel-only; one ad, five organizers/reviews; demos are excluded locally and labeled.");
