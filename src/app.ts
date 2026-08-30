import express, { type Express, type Request, type Response } from "express";
import type { KeelSessionRecord } from "./domain/agentforce.js";
import { createS3Client, loadSessions, storageConfig } from "./storage/s3.js";
import { renderEnterpriseActing, renderError, renderOrgAgents, renderSessionAudit, type ScreenRoute } from "./ui/render.js";

export type SessionLoader = () => Promise<KeelSessionRecord[]>;

export function runtimeLoader(): SessionLoader {
  const config = storageConfig();
  const client = createS3Client(config);
  return () => loadSessions(client, config.bucket);
}

function screen(
  loader: SessionLoader,
  route: ScreenRoute,
  title: string,
  render: (records: KeelSessionRecord[], request: Request) => string,
) {
  return async (request: Request, response: Response) => {
    try {
      const records = await loader();
      if (records.length === 0) throw new Error("The MinIO manifest did not resolve to any sessions");
      response.status(200).type("html").send(render(records, request));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown MinIO load error";
      response.status(503).type("html").send(renderError(route, title, detail));
    }
  };
}

export function createApp(loader: SessionLoader = runtimeLoader()): Express {
  const app = express();
  app.disable("x-powered-by");
  app.get(
    "/session-audit",
    screen(loader, "/session-audit", "Session audit", (records, request) =>
      renderSessionAudit(records, typeof request.query.session === "string" ? request.query.session : undefined),
    ),
  );
  app.get("/org-agents", screen(loader, "/org-agents", "Org agents", (records) => renderOrgAgents(records)));
  app.get(
    "/enterprise-acting",
    screen(loader, "/enterprise-acting", "Enterprise acting", (records) => renderEnterpriseActing(records)),
  );
  return app;
}
