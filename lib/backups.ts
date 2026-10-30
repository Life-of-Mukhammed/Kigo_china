import { env } from "cloudflare:workers";
import { ApiError, find, statement, audit, type Row } from "@/lib/kigo-store";
import { claimLease, listRecords, recordWrite, writeRecords } from "@/lib/record-store";
import { digest } from "@/lib/auth-crypto";
import hosting from "@/.openai/hosting.json";

const MAX_BYTES = 10 * 1024 * 1024;
const EXCLUDED = ["auth-session", "auth-attempt", "rate", "backup", "system"];
export type Snapshot = { version: 1; projectId: string; createdAt: string; recordCount: number; checksum: string; records: Row[] };

export async function createBackup(owner: string, reason = "manual") {
  const all = await listRecords();
  const records = all.filter((record) => !EXCLUDED.includes(record.kind));
  const bytes = records.reduce((total, record) => total + new TextEncoder().encode(JSON.stringify(record)).byteLength, 0);
  if (records.length > 25000 || bytes > MAX_BYTES)
    throw new ApiError("Zaxira hajmi chegaradan oshdi. Bazani operator orqali eksport qiling.", 413);
  if (new TextEncoder().encode(JSON.stringify(records)).byteLength > MAX_BYTES)
    throw new ApiError("Zaxira hajmi chegaradan oshdi.", 413);
  const createdAt = new Date().toISOString();
  const id = crypto.randomUUID();
  const checksum = await digest(JSON.stringify(records));
  const snapshot: Snapshot = { version: 1, projectId: hosting.project_id, createdAt, recordCount: records.length, checksum, records };
  const content = JSON.stringify(snapshot);
  const key = `backups/v1/${createdAt.slice(0, 10)}/${id}.json`;
  await env.BUCKET.put(key, content, { httpMetadata: { contentType: "application/json" }, customMetadata: { checksum, reason } });
  const data = { name: "KiGo " + createdAt, key, reason, recordCount: records.length, checksum, size: new TextEncoder().encode(content).byteLength, createdAt, projectId: hosting.project_id };
  await writeRecords([statement(id, "backup", owner, "", data), await audit(owner, "create-backup", id, null, { reason, recordCount: records.length, checksum })]);
  return { id, ...data };
}

export async function automaticBackup() {
  const now = Date.now();
  if (!(await claimLease("backup:auto:lease", now + 15 * 60000, now))) return "recent";
  try {
    const backup = await createBackup("system", "automatic-after-write");
    await writeRecords([statement("backup:last-status", "system", "system", "", { ok: true, at: backup.createdAt, backupId: backup.id })]);
    return "created";
  } catch {
    await writeRecords([
      statement("backup:last-status", "system", "system", "", { ok: false, at: new Date().toISOString(), error: "Zaxira yaratilmadi. Admin paneldan qayta urining." }),
      statement("backup:auto:lease", "system", "system", "", { until: Date.now() + 60000 }),
    ]);
    console.error("KiGo automatic backup failed");
    return "failed";
  }
}

export async function backupStatus() {
  const rows = await listRecords("backup");
  const last = rows.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const statusRecord = await find("backup:last-status");
  return {
    last: last ? { ...JSON.parse(last.data), id: last.id } : null,
    status: statusRecord ? { ok: statusRecord.ok, at: statusRecord.at, error: statusRecord.error } : null,
    automatic: "Yozish amallaridan keyin, faoliyat bor paytda 15 daqiqada bir",
    storage: process.env.VERCEL
      ? process.env.R2_ENDPOINT && process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
        ? "MongoDB + R2"
        : "MongoDB fayl saqlash"
      : "D1 + R2",
    permanentDelete: false,
  };
}

export async function readSnapshot(id: string) {
  const backup = await find(id);
  if (!backup || backup.kind !== "backup" || backup.deletedAt || typeof backup.key !== "string" || !backup.key.startsWith("backups/v1/"))
    throw new ApiError("Zaxira nusxa topilmadi", 404);
  const object = await env.BUCKET.get(backup.key);
  if (!object) throw new ApiError("Zaxira fayli topilmadi", 404);
  if (object.size > MAX_BYTES + 1024 * 1024) throw new ApiError("Zaxira fayli juda katta", 413);
  const raw = await object.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES + 1024 * 1024) throw new ApiError("Zaxira hajmi katta", 413);
  const snapshot = JSON.parse(raw) as Snapshot;
  if (snapshot.version !== 1 || snapshot.projectId !== hosting.project_id || !Array.isArray(snapshot.records) || snapshot.records.length !== snapshot.recordCount || snapshot.recordCount > 25000)
    throw new ApiError("Zaxira formati yoki loyiha mos emas");
  const checksum = await digest(JSON.stringify(snapshot.records));
  if (checksum !== snapshot.checksum || checksum !== backup.checksum) throw new ApiError("Zaxira faylining yaxlitligi buzilgan", 409);
  const ids = new Set<string>();
  for (const record of snapshot.records) {
    if (!record || typeof record.id !== "string" || record.id.length > 2000 || ids.has(record.id) || typeof record.kind !== "string" || EXCLUDED.includes(record.kind) || typeof record.owner !== "string" || typeof record.target !== "string" || typeof record.data !== "string" || typeof record.created_at !== "string")
      throw new ApiError("Zaxira yozuvi noto‘g‘ri");
    JSON.parse(record.data);
    ids.add(record.id);
  }
  return { metadata: backup, snapshot, raw };
}

export async function restorePreview(id: string) {
  const { snapshot } = await readSnapshot(id);
  const current = await listRecords();
  const existing = new Map(current.filter((record) => !EXCLUDED.includes(record.kind)).map((record) => [record.id, record.data]));
  const missing = snapshot.records.filter((record) => !existing.has(record.id));
  const changed = snapshot.records.filter((record) => existing.has(record.id) && existing.get(record.id) !== record.data);
  return { recordCount: snapshot.recordCount, missing: missing.length, changed: changed.length, unchanged: snapshot.recordCount - missing.length - changed.length, missingIds: missing.map((record) => record.id), changedIds: changed.map((record) => record.id), createdAt: snapshot.createdAt, checksum: snapshot.checksum };
}

export async function restoreRecords(userId: string, id: string, ids: string[], mode: "missing" | "replace", safetyBackupId?: string) {
  if (!ids.length || ids.length > 25) throw new ApiError("Bir so‘rovda 1–25 yozuv tanlang");
  const { snapshot } = await readSnapshot(id);
  const lookup = new Map(snapshot.records.map((record) => [record.id, record]));
  if (new Set(ids).size !== ids.length || ids.some((recordId) => !lookup.has(recordId))) throw new ApiError("Tanlangan yozuvlar zaxirada topilmadi");
  let safety = safetyBackupId ? await find(safetyBackupId) : null;
  if (!safety || safety.kind !== "backup" || safety.reason !== "before-restore:" + id || safety.ownerId !== userId || Date.parse(safety.createdAt) < Date.now() - 30 * 60000)
    safety = await createBackup(userId, "before-restore:" + id);
  const writes = ids.map((recordId) => {
    const record = lookup.get(recordId)!;
    return recordWrite(record.id, record.kind, record.owner, record.target, JSON.parse(record.data), mode === "missing" ? { insertOnly: true } : { replace: true });
  });
  writes.push(await audit(userId, "restore-backup", id, null, { mode, ids, safetyBackupId: safety.id }));
  const results = await writeRecords(writes);
  return { restored: results.slice(0, -1).reduce((total, changes) => total + changes, 0), safetyBackupId: safety.id };
}
