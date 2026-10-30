import type { MongoClient, Collection, ClientSession } from "mongodb";
import { env } from "cloudflare:workers";

export type StoredRecord = {
  id: string;
  kind: string;
  owner: string;
  target: string;
  data: string;
  created_at: string;
};

export type RecordWrite = {
  record: StoredRecord;
  expectedUpdatedAt?: string;
  insertOnly?: boolean;
  onlyIfChanged?: boolean;
  replace?: boolean;
};

type MongoRecord = StoredRecord & { payload: Record<string, unknown> };
const useMongo = Boolean(process.env.VERCEL);
const globalMongo = globalThis as typeof globalThis & { kigoMongoClient?: Promise<MongoClient>; kigoMongoIndexes?: Promise<void> };

async function mongoCollection(): Promise<Collection<MongoRecord>> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Vercel environment variable MONGODB_URI is not configured.");
  const { MongoClient } = await import("mongodb");
  globalMongo.kigoMongoClient ??= new MongoClient(uri, { serverSelectionTimeoutMS: 10000 }).connect();
  const client = await globalMongo.kigoMongoClient;
  const collection = client.db(process.env.MONGODB_DB || "kigo").collection<MongoRecord>("records");
  globalMongo.kigoMongoIndexes ??= Promise.all([
    collection.createIndex({ id: 1 }, { unique: true }),
    collection.createIndex({ kind: 1, owner: 1, created_at: -1 }),
    collection.createIndex({ kind: 1, target: 1 }),
  ]).then(() => undefined);
  await globalMongo.kigoMongoIndexes;
  return collection;
}

function mongoDoc(record: StoredRecord): MongoRecord {
  return { ...record, payload: JSON.parse(record.data) as Record<string, unknown> };
}

async function plainRow(collection: Collection<MongoRecord>, record: MongoRecord): Promise<StoredRecord | null> {
  const { id, kind, owner, target, data, created_at } = record;
  const payload = record.payload;
  const row: StoredRecord = { id, kind, owner, target, data, created_at };
  try {
    JSON.parse(row.data);
    return row;
  } catch {
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const repaired = JSON.stringify(payload);
      await collection.updateOne({ id: row.id, data: row.data }, { $set: { data: repaired } });
      console.error("Recovered invalid MongoDB record JSON:", row.id, row.kind);
      return { ...row, data: repaired };
    }
    console.error("Skipped MongoDB record with invalid JSON and no payload:", row.id, row.kind);
    return null;
  }
}

export async function findRecord(id: string): Promise<StoredRecord | null> {
  if (useMongo) {
    const collection = await mongoCollection();
    const row = await collection.findOne({ id });
    return row ? plainRow(collection, row) : null;
  }
  return env.DB.prepare("SELECT * FROM records WHERE id=?").bind(id).first<StoredRecord>();
}

export async function listRecords(kind?: string): Promise<StoredRecord[]> {
  if (useMongo) {
    const collection = await mongoCollection();
    const rows = await collection.find(kind ? { kind } : {}).toArray();
    return (await Promise.all(rows.map((row) => plainRow(collection, row)))).filter((row): row is StoredRecord => row !== null);
  }
  const query = kind ? env.DB.prepare("SELECT * FROM records WHERE kind=?").bind(kind) : env.DB.prepare("SELECT * FROM records");
  return (await query.all<StoredRecord>()).results;
}

function d1Write(write: RecordWrite) {
  const { record, expectedUpdatedAt, insertOnly } = write;
  if (write.onlyIfChanged)
    return env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) SELECT ?,'audit',?,?,?,? WHERE changes()>0")
      .bind(record.id, record.owner, record.target, record.data, record.created_at);
  if (expectedUpdatedAt !== undefined)
    return env.DB.prepare("UPDATE records SET data=?,target=? WHERE id=? AND json_extract(data,'$.updatedAt')=?")
      .bind(record.data, record.target, record.id, expectedUpdatedAt);
  if (insertOnly)
    return env.DB.prepare("INSERT OR IGNORE INTO records(id,kind,owner,target,data,created_at) VALUES(?,?,?,?,?,?)")
      .bind(record.id, record.kind, record.owner, record.target, record.data, record.created_at);
  return env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,owner=excluded.owner,target=excluded.target,data=excluded.data,created_at=excluded.created_at")
    .bind(record.id, record.kind, record.owner, record.target, record.data, record.created_at);
}

async function applyMongoWrite(collection: Collection<MongoRecord>, write: RecordWrite, session?: ClientSession) {
  const filter: Record<string, unknown> = { id: write.record.id };
  if (write.expectedUpdatedAt !== undefined)
    filter["payload.updatedAt"] = write.expectedUpdatedAt;
  const doc = mongoDoc(write.record);
  const sessionOptions = session ? { session } : {};
  const result = write.insertOnly
    ? await collection.updateOne(filter, { $setOnInsert: doc }, { ...sessionOptions, upsert: true })
    : write.replace
      ? await collection.replaceOne(filter, doc, { ...sessionOptions, upsert: write.expectedUpdatedAt === undefined })
      : await collection.updateOne(
          filter,
          {
            $set: { kind: write.record.kind, owner: write.record.owner, target: write.record.target, data: write.record.data, payload: doc.payload },
            $setOnInsert: { id: write.record.id, created_at: write.record.created_at },
          },
          { ...sessionOptions, upsert: write.expectedUpdatedAt === undefined },
        );
  return write.insertOnly ? result.upsertedCount : (result.matchedCount || result.upsertedCount);
}

export async function writeRecords(writes: RecordWrite[]): Promise<number[]> {
  if (!writes.length) return [];
  if (useMongo) {
    const collection = await mongoCollection();
    if (writes.length === 1) return [await applyMongoWrite(collection, writes[0])];
    const client = await globalMongo.kigoMongoClient!;
    const changes: number[] = [];
    let precedingChanged = true;
    await client.withSession(async (session: ClientSession) => session.withTransaction(async () => {
      for (const write of writes) {
        if (write.onlyIfChanged && !precedingChanged) {
          changes.push(0);
          continue;
        }
        const changed = await applyMongoWrite(collection, write, session);
        changes.push(changed);
        precedingChanged = changed > 0;
      }
    }));
    return changes;
  }
  const results = await env.DB.batch(writes.map(d1Write));
  return results.map((result) => result.meta.changes || 0);
}

export async function incrementRateRecord(id: string, owner: string) {
  if (useMongo) {
    const collection = await mongoCollection();
    await collection.updateOne(
      { id },
      { $setOnInsert: { id, kind: "rate", owner, target: "", created_at: new Date().toISOString() }, $inc: { "payload.count": 1 } },
      { upsert: true },
    );
    const row = await collection.findOne({ id });
    return row ? Number(row.payload.count) : 0;
  }
  const row = await env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) VALUES(?,'rate',?,'',?,?) ON CONFLICT(id) DO UPDATE SET data=json_set(records.data,'$.count',json_extract(records.data,'$.count')+1) RETURNING data")
    .bind(id, owner, JSON.stringify({ count: 1 }), new Date().toISOString()).first<{ data: string }>();
  return row ? Number(JSON.parse(row.data).count) : 0;
}

export async function createRegistrationIfAvailable(record: StoredRecord, capacity: number) {
  if (!useMongo) {
    const result = await env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) SELECT ?,'registration',?,?,?,? WHERE (SELECT count(*) FROM records WHERE kind='registration' AND target=? AND json_extract(data,'$.deletedAt') IS NULL AND json_extract(data,'$.status') NOT IN ('cancelled','rejected')) < ? ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE json_extract(records.data,'$.status') IN ('cancelled','rejected')")
      .bind(record.id, record.owner, record.target, record.data, record.created_at, record.target, capacity).run();
    return result.meta.changes || 0;
  }
  const collection = await mongoCollection();
  const client = await globalMongo.kigoMongoClient!;
  let created = 0;
  await client.withSession(async (session) => session.withTransaction(async () => {
    await collection.updateOne(
      { id: "capacity-lock:" + record.target },
      {
        $inc: { writeRevision: 1 },
        $setOnInsert: { id: "capacity-lock:" + record.target, kind: "system", owner: "system", target: record.target, data: "{}", payload: {}, created_at: new Date().toISOString() },
      },
      { upsert: true, session },
    );
    const old = await collection.findOne({ id: record.id }, { session });
    if (old && !["cancelled", "rejected"].includes(String(old.payload.status))) return;
    const active = await collection.countDocuments({
      kind: "registration",
      target: record.target,
      "payload.deletedAt": { $exists: false },
      "payload.status": { $nin: ["cancelled", "rejected"] },
    }, { session });
    if (!old && active >= capacity) return;
    const doc = mongoDoc(record);
    await collection.replaceOne({ id: record.id }, doc, { session, upsert: true });
    created = 1;
  }));
  return created;
}

export async function pingRecordStore() {
  if (useMongo) {
    const client = await globalMongo.kigoMongoClient!;
    await client.db(process.env.MONGODB_DB || "kigo").command({ ping: 1 });
    return;
  }
  await env.DB.prepare("SELECT 1").first();
}

export async function claimLease(id: string, until: number, now: number) {
  const record = recordWrite(id, "system", "system", "", { until });
  if (useMongo) {
    const result = await (await mongoCollection()).updateOne(
      { id, $or: [{ "payload.until": { $lt: now } }, { payload: { $exists: false } }] },
      { $set: mongoDoc(record.record) },
      { upsert: true },
    ).catch((error: { code?: number }) => {
      if (error.code === 11000) return null;
      throw error;
    });
    return Boolean(result && (result.matchedCount || result.upsertedCount));
  }
  const result = await env.DB.prepare("INSERT INTO records(id,kind,owner,target,data,created_at) VALUES(?,'system','system','',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE json_extract(records.data,'$.until')<? RETURNING id")
    .bind(id, JSON.stringify({ until }), new Date().toISOString(), now).first();
  return Boolean(result);
}

export async function countMatching(predicate: (record: StoredRecord) => boolean, kind?: string) {
  return (await listRecords(kind)).filter(predicate).length;
}

export async function removeRecord(id: string, kind?: string) {
  if (useMongo) {
    const result = await (await mongoCollection()).deleteOne({ id, ...(kind ? { kind } : {}) });
    return result.deletedCount;
  }
  const result = await env.DB.prepare("DELETE FROM records WHERE id=?" + (kind ? " AND kind=?" : ""))
    .bind(...(kind ? [id, kind] : [id])).run();
  return result.meta.changes || 0;
}

export async function takeRecord(id: string, kind: string) {
  if (useMongo) {
    const collection = await mongoCollection();
    const result = await collection.findOneAndDelete({ id, kind });
    return result ? (await plainRow(collection, result)) : null;
  }
  return env.DB.prepare("DELETE FROM records WHERE id=? AND kind=? RETURNING *").bind(id, kind).first<StoredRecord>();
}

export async function removeRecords(predicate: (record: StoredRecord) => boolean, kind?: string) {
  const ids = (await listRecords(kind)).filter(predicate).map((record) => record.id);
  let removed = 0;
  for (const id of ids) removed += await removeRecord(id);
  return removed;
}

export function recordWrite(
  id: string,
  kind: string,
  owner: string,
  target: string,
  data: Record<string, unknown>,
  options: Omit<RecordWrite, "record"> = {},
): RecordWrite {
  return {
    record: { id, kind, owner, target, data: JSON.stringify(data), created_at: new Date().toISOString() },
    ...options,
  };
}
