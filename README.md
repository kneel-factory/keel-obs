# Keel observability

Keel is a small, fail-closed observability app for enterprise agents. It maps real [CoVe-12k](https://huggingface.co/datasets/Zichen1024/CoVe-12k) tool-use trajectories to the Agentforce session grammar, stores the golden sessions in MinIO through the S3 API, and renders exactly three read-only screens.

## Run locally

Requirements: Node.js 20+, npm, Docker, and Docker Compose.

```bash
npm ci
docker compose up -d
make seed
```

Seeding downloads 12 real CoVe-12k rows by default: six from the airline region and six from the retail region of the train split. It writes one session object per row plus `manifest.json` to the `keel-observability` MinIO bucket. No generated trajectory or UI fixture is used.

Open:

- Session audit: http://localhost:3000/session-audit
- Organization agents: http://localhost:3000/org-agents
- Enterprise acting: http://localhost:3000/enterprise-acting

MinIO’s local console is at http://localhost:9001 (`keel` / `keel-local-secret`). Before a successful seed—or whenever an object cannot be loaded—the app returns a visible `503` fail-closed screen.

To choose a different real slice size or offsets:

```bash
SEED_LIMIT=20 COVE_SLICE_OFFSETS=0,6000 make seed
```

`SEED_LIMIT` accepts 1–100. The app always loads the exact object keys in the latest MinIO manifest.

## Verify

```bash
npm test
npm run lint
npm run build
```

The optional integration test requires MinIO and internet access. It fetches live rows from Hugging Face, writes them to a temporary MinIO bucket, reloads the typed session grammar, and removes only that uniquely named test bucket afterward.

```bash
docker compose up -d minio
npm run test:integration
```

## Data boundary

All three routes use the same `KeelSessionRecord[]` returned by the MinIO loader. CoVe-12k does not include trustworthy timestamps, model/version, token, cost, or latency fields, so Keel leaves those values empty and says “Not recorded.” It does not generate Salesforce IDs. The complete design and data flow are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); the locked screen contracts are in [screens/](screens/).
