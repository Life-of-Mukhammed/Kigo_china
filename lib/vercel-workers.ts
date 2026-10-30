import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getMongoFile, putMongoFile } from "@/lib/mongo-files";

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

function requireBucket() {
  if (!s3 || !process.env.R2_BUCKET_NAME)
    throw new Error("Set R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in Vercel environment variables.");
  return s3;
}

const hasR2 = Boolean(process.env.R2_ENDPOINT && process.env.R2_BUCKET_NAME && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);

const BUCKET = {
  async put(key: string, value: ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }) {
    const body = typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof ArrayBuffer
        ? new Uint8Array(value)
        : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (!hasR2) {
      await putMongoFile(key, body, options?.httpMetadata?.contentType, options?.customMetadata);
      return;
    }
    await requireBucket().send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: options?.httpMetadata?.contentType,
      Metadata: options?.customMetadata,
    }));
  },
  async get(key: string) {
    if (!hasR2) {
      const result = await getMongoFile(key);
      if (!result) return null;
      const bytes = Buffer.from(result.bytes);
      return {
        size: bytes.byteLength,
        body: new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]).stream(),
        text: () => new TextDecoder().decode(bytes),
        httpMetadata: { contentType: result.contentType },
      };
    }
    const result = await requireBucket().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return {
      size: bytes.byteLength,
      body: new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer]).stream(),
      text: () => new TextDecoder().decode(bytes),
      httpMetadata: { contentType: result.ContentType },
    };
  },
};

export const env = {
  DB: undefined,
  BUCKET,
  KIGO_ADMIN_EMAILS: process.env.KIGO_ADMIN_EMAILS,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  KIGO_PUBLIC_ORIGIN: process.env.KIGO_PUBLIC_ORIGIN,
};
