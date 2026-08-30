import type { S3Client } from "@aws-sdk/client-s3";
import type { CoveRow, KeelSessionRecord } from "../domain/agentforce.js";
import { ensureBucket, MANIFEST_KEY, putJson, type KeelManifest } from "../storage/s3.js";
import { assertCoveRow, coveRowToSession } from "./transform.js";

const DATASET = "Zichen1024/CoVe-12k";
const DATASET_ENDPOINT = "https://datasets-server.huggingface.co/rows";
const DEFAULT_SLICE_OFFSETS = [0, 6000];

interface DatasetServerRow {
  row_idx: number;
  row: unknown;
}

interface DatasetServerResponse {
  rows?: DatasetServerRow[];
}

export interface SeedOptions {
  client: S3Client;
  bucket: string;
  limit: number;
  fetcher?: typeof fetch;
  offsets?: number[];
}

async function fetchRange(offset: number, length: number, fetcher: typeof fetch): Promise<Array<{ rowIndex: number; row: CoveRow }>> {
  const url = new URL(DATASET_ENDPOINT);
  url.searchParams.set("dataset", DATASET);
  url.searchParams.set("config", "default");
  url.searchParams.set("split", "train");
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("length", String(length));
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`CoVe-12k fetch failed with ${response.status} ${response.statusText}`);
  const payload = (await response.json()) as DatasetServerResponse;
  if (!Array.isArray(payload.rows) || payload.rows.length !== length) {
    throw new Error(`CoVe-12k returned ${payload.rows?.length ?? 0} rows; expected ${length}`);
  }
  return payload.rows.map((item) => {
    assertCoveRow(item.row);
    return { rowIndex: item.row_idx, row: item.row };
  });
}

export async function fetchCoveSlice(
  limit: number,
  fetcher: typeof fetch = fetch,
  offsets: number[] = DEFAULT_SLICE_OFFSETS,
): Promise<Array<{ rowIndex: number; row: CoveRow }>> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("SEED_LIMIT must be an integer from 1 to 100");
  }
  if (offsets.length === 0) throw new Error("At least one CoVe slice offset is required");

  const base = Math.floor(limit / offsets.length);
  let remainder = limit % offsets.length;
  const requests = offsets
    .map((offset) => {
      const length = base + (remainder-- > 0 ? 1 : 0);
      return { offset, length };
    })
    .filter(({ length }) => length > 0);
  const ranges = await Promise.all(requests.map(({ offset, length }) => fetchRange(offset, length, fetcher)));
  return ranges.flat();
}

export async function seedCove(options: SeedOptions): Promise<KeelSessionRecord[]> {
  const rows = await fetchCoveSlice(options.limit, options.fetcher, options.offsets);
  const records = rows.map(({ rowIndex, row }) => coveRowToSession(rowIndex, row));
  await ensureBucket(options.client, options.bucket);
  const objects: string[] = [];
  for (const record of records) {
    const key = `sessions/${record.AiAgentSession.Id.replaceAll("/", "_")}.json`;
    await putJson(options.client, options.bucket, key, record);
    objects.push(key);
  }
  const manifest: KeelManifest = {
    schemaVersion: "keel.manifest.v1",
    dataset: DATASET,
    objects,
  };
  await putJson(options.client, options.bucket, MANIFEST_KEY, manifest);
  return records;
}
