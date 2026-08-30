import { randomUUID } from "node:crypto";
import {
  DeleteBucketCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { afterAll, describe, expect, it } from "vitest";
import { seedCove } from "../src/seed/cove.js";
import { createS3Client, loadSessions, storageConfig } from "../src/storage/s3.js";

const enabled = process.env.RUN_MINIO_TESTS === "1";
const baseConfig = storageConfig();
const bucket = `keel-integration-${randomUUID()}`;
const client = createS3Client(baseConfig);

describe.skipIf(!enabled)("real CoVe seed through MinIO", () => {
  afterAll(async () => {
    const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
    if (listed.Contents?.length) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: listed.Contents.flatMap((object) => (object.Key ? [{ Key: object.Key }] : [])) },
        }),
      );
    }
    await client.send(new DeleteBucketCommand({ Bucket: bucket }));
    client.destroy();
  });

  it("fetches real HF rows, writes session objects, and loads the typed grammar", async () => {
    const seeded = await seedCove({ client, bucket, limit: 2 });
    const loaded = await loadSessions(client, bucket);

    expect(seeded).toHaveLength(2);
    expect(loaded).toHaveLength(2);
    expect(loaded.map((record) => record.source.rowIndex)).toEqual([0, 6000]);
    expect(
      new Set(
        loaded.flatMap((record) =>
          record.AiAgentSessionParticipant.flatMap((participant) =>
            participant.AiAgentApiName ? [participant.AiAgentApiName] : [],
          ),
        ),
      ),
    ).toEqual(new Set(["airline", "retail"]));
    expect(loaded.every((record) => record.AiAgentInteraction.length > 0)).toBe(true);
    expect(loaded.every((record) => record.AiAgentInteractionStep.some((step) => step.AiAgentInteractionStepType === "ACTION_STEP"))).toBe(true);
  }, 60_000);
});
