import { createClient, type Client, type InValue } from "@libsql/client";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type Row = Record<string, unknown>;
type Result = { results: Row[]; success: true; meta: { changes: number; last_row_id?: number } };
type Prepared = { sql: string; args: InValue[] };

function objectRows(result: Awaited<ReturnType<Client["execute"]>>) {
  return result.rows.map((row) => Object.fromEntries(result.columns.map((column, index) => [column, row[index]])) as Row);
}

const client: Client | undefined = process.env.TURSO_DATABASE_URL
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : undefined;
const s3 = process.env.R2_ENDPOINT
  ? new S3Client({
      region: process.env.R2_REGION || "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
      },
    })
  : undefined;

function requireDb(): Client {
  if (!client) throw new Error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel environment variables.");
  return client;
}

function requireBucket(): S3Client {
  if (!s3 || !process.env.R2_BUCKET_NAME) throw new Error("Set R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in Vercel environment variables.");
  return s3;
}

class VercelStatement {
  private args: InValue[] = [];

  constructor(private readonly sql: string) {}

  bind(...args: InValue[]) {
    this.args = args;
    return this;
  }

  prepared(): Prepared {
    return { sql: this.sql, args: this.args };
  }

  async first<T extends Row = Row>(): Promise<T | null> {
    const result = await requireDb().execute(this.prepared());
    return (objectRows(result)[0] as T | undefined) ?? null;
  }

  async all<T extends Row = Row>(): Promise<Result & { results: T[] }> {
    const result = await requireDb().execute(this.prepared());
    return {
      results: objectRows(result) as T[],
      success: true,
      meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid || 0) },
    };
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id?: number } }> {
    const result = await requireDb().execute(this.prepared());
    return { success: true, meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid || 0) } };
  }
}

const DB = {
  prepare(sql: string) {
    return new VercelStatement(sql);
  },
  async batch(statements: VercelStatement[]) {
    const results = await requireDb().batch(statements.map((statement) => statement.prepared()), "write");
    return results.map((result) => ({
      success: true as const,
      meta: { changes: result.rowsAffected, last_row_id: Number(result.lastInsertRowid || 0) },
    }));
  },
};

const BUCKET = {
  async put(key: string, value: ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
    const body = typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    await requireBucket().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: options?.httpMetadata?.contentType,
      Metadata: options?.customMetadata,
    }));
  },
  async get(key: string) {
    const result = await requireBucket().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    const text = () => new TextDecoder().decode(bytes);
    return {
      size: bytes.byteLength,
      body: new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]).stream(),
      text,
      httpMetadata: { contentType: result.ContentType },
    };
  },
};

export const env = {
  DB,
  BUCKET,
  KIGO_ADMIN_EMAILS: process.env.KIGO_ADMIN_EMAILS,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  KIGO_PUBLIC_ORIGIN: process.env.KIGO_PUBLIC_ORIGIN,
};
