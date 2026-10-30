import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
