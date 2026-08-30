import { createS3Client, storageConfig, waitForStorage } from "../storage/s3.js";
import { seedCove } from "./cove.js";

const config = storageConfig();
const client = createS3Client(config);
const limit = Number.parseInt(process.env.SEED_LIMIT ?? "12", 10);
const offsets = process.env.COVE_SLICE_OFFSETS
  ? process.env.COVE_SLICE_OFFSETS.split(",").map((value) => Number.parseInt(value.trim(), 10))
  : undefined;

try {
  await waitForStorage(client);
  const records = await seedCove({ client, bucket: config.bucket, limit, offsets });
  const sources = [...new Set(records.flatMap((record) =>
    record.AiAgentSessionParticipant.map((participant) => participant.AiAgentApiName).filter(Boolean),
  ))];
  console.log(`Seeded ${records.length} real CoVe-12k sessions to s3://${config.bucket}`);
  console.log(`Source-backed agent identities: ${sources.join(", ")}`);
} finally {
  client.destroy();
}
