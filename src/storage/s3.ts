import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { assertKeelSessionRecord, type KeelSessionRecord } from "../domain/agentforce.js";

export const MANIFEST_KEY = "manifest.json";

export interface KeelManifest {
  schemaVersion: "keel.manifest.v1";
  dataset: "Zichen1024/CoVe-12k";
  objects: string[];
}

export interface StorageConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export function storageConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  return {
    endpoint: env.MINIO_ENDPOINT ?? "http://127.0.0.1:9000",
    accessKey: env.MINIO_ACCESS_KEY ?? "keel",
    secretKey: env.MINIO_SECRET_KEY ?? "keel-local-secret",
    bucket: env.MINIO_BUCKET ?? "keel-observability",
  };
}

export function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: config.accessKey, secretAccessKey: config.secretKey },
  });
}

export async function ensureBucket(client: S3Client, bucket: string): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function waitForStorage(client: S3Client, attempts = 20): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await client.send(new ListBucketsCommand({}));
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("MinIO did not become ready");
}

export async function putJson(client: S3Client, bucket: string, key: string, value: unknown): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(value),
      ContentType: "application/json",
    }),
  );
}

async function getJson(client: S3Client, bucket: string, key: string): Promise<unknown> {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) throw new Error(`MinIO object ${key} has no body`);
  return JSON.parse(await response.Body.transformToString());
}

function assertManifest(value: unknown): asserts value is KeelManifest {
  const manifest = value as Partial<KeelManifest> | null;
  if (
    !manifest ||
    manifest.schemaVersion !== "keel.manifest.v1" ||
    manifest.dataset !== "Zichen1024/CoVe-12k" ||
    !Array.isArray(manifest.objects) ||
    manifest.objects.length === 0 ||
    manifest.objects.some((key) => typeof key !== "string" || !key.startsWith("sessions/"))
  ) {
    throw new Error("MinIO manifest is missing, empty, or malformed");
  }
}

export async function loadSessions(client: S3Client, bucket: string): Promise<KeelSessionRecord[]> {
  const manifestValue = await getJson(client, bucket, MANIFEST_KEY);
  assertManifest(manifestValue);
  const records = await Promise.all(
    manifestValue.objects.map(async (key) => {
      const value = await getJson(client, bucket, key);
      assertKeelSessionRecord(value);
      return value;
    }),
  );
  return records.sort((left, right) => left.source.rowIndex - right.source.rowIndex);
}
