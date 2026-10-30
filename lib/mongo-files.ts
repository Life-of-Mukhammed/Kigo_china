import type { MongoClient } from "mongodb";

type FileRecord = {
  _id: string;
  bytes: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
};

const globalFiles = globalThis as typeof globalThis & {
  kigoFilesClient?: Promise<MongoClient>;
};

async function fileCollection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  const { MongoClient } = await import("mongodb");
  globalFiles.kigoFilesClient ??= new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  }).connect();
  const client = await globalFiles.kigoFilesClient;
  return client.db(process.env.MONGODB_DB || "kigo").collection<FileRecord>("files");
}

export async function putMongoFile(
  key: string,
  bytes: Uint8Array,
  contentType?: string,
  metadata?: Record<string, string>,
) {
  await (await fileCollection()).updateOne(
    { _id: key },
    { $set: { bytes: Buffer.from(bytes), contentType, metadata } },
    { upsert: true },
  );
}

export async function getMongoFile(key: string) {
  return (await fileCollection()).findOne({ _id: key });
}
