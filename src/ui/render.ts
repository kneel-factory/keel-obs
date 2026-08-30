import type {
  AiAgentInteraction,
  AiAgentInteractionStep,
  KeelSessionRecord,
} from "../domain/agentforce.js";
import {
  actionOutcome,
  agentSummaries,
  enterpriseEvidence,
  humanize,
  type ActionEvidence,
  type ActionOutcome,
} from "../domain/analytics.js";

export type ScreenRoute = "/session-audit" | "/org-agents" | "/enterprise-acting";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function recorded(value: string | null | undefined, fallback = "Not recorded"): string {
  return value ? escapeHtml(value) : `<span class="muted-value">${fallback}</span>`;
}

function shortId(value: string): string {
  const parts = value.split("/");
  return parts.length > 3 ? `${parts[0]}/${parts[1]}/${parts[2]}/…${parts.at(-1)?.slice(-6)}` : value;
}

function outcomeLabel(outcome: ActionOutcome): string {
  if (outcome === "not-recorded") return "Not recorded";
  return outcome[0]?.toUpperCase() + outcome.slice(1);
}

function badge(label: string, tone: "green" | "amber" | "red" | "blue" | "neutral" = "neutral"): string {
  return `<span class="badge ${tone}"><span class="badge-dot"></span>${escapeHtml(label)}</span>`;
}

function outcomeBadge(outcome: ActionOutcome): string {
  return badge(outcomeLabel(outcome), outcome === "completed" ? "green" : outcome === "failed" ? "red" : "neutral");
}

const styles = `
  :root { color-scheme: light; --ink:#18221c; --sub:#617067; --line:#dce3de; --line-strong:#c8d2cb; --paper:#f5f7f4; --white:#fff; --nav:#14261c; --nav-muted:#9fb1a6; --lime:#c9f26b; --green:#236b45; --green-soft:#e5f4ea; --blue:#366a8d; --blue-soft:#e9f2f7; --amber:#a86718; --amber-soft:#fff2da; --red:#a84940; --red-soft:#fdecea; --shadow:0 1px 2px rgba(18,36,25,.05),0 8px 24px rgba(18,36,25,.04); }
  * { box-sizing:border-box; }
  html { background:var(--paper); }
  body { margin:0; color:var(--ink); font:14px/1.5 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; letter-spacing:-.01em; }
  a { color:inherit; }
  .app { min-height:100vh; display:grid; grid-template-columns:236px minmax(0,1fr); }
  .sidebar { background:var(--nav); color:white; min-height:100vh; padding:26px 18px; position:sticky; top:0; height:100vh; display:flex; flex-direction:column; }
  .brand { display:flex; align-items:center; gap:11px; font-size:18px; font-weight:700; padding:0 9px 30px; letter-spacing:-.03em; }
  .mark { width:28px; height:28px; border:1px solid #769283; border-radius:8px; display:grid; place-items:center; background:#1e3528; }
  .mark:before { content:""; width:12px; height:12px; border-left:2px solid var(--lime); border-bottom:2px solid var(--lime); transform:skew(-8deg) rotate(-45deg); margin-top:-3px; }
  .nav-label { padding:0 11px 8px; color:#748b7d; text-transform:uppercase; letter-spacing:.13em; font-size:10px; font-weight:700; }
  nav { display:grid; gap:5px; }
  nav a { color:var(--nav-muted); text-decoration:none; padding:10px 11px; border-radius:8px; display:flex; align-items:center; gap:10px; font-weight:590; }
  nav a:before { content:""; width:7px; height:7px; border:1.5px solid currentColor; border-radius:50%; opacity:.75; }
  nav a.active { color:white; background:#20392b; }
  nav a.active:before { background:var(--lime); border-color:var(--lime); box-shadow:0 0 0 3px rgba(201,242,107,.12); }
  .source-lockup { margin-top:auto; padding:14px 11px 2px; border-top:1px solid #294033; color:var(--nav-muted); font-size:12px; }
  .source-lockup strong { display:block; color:#e6eee9; margin-bottom:3px; font-size:12px; }
  .source-lockup strong:before { content:""; display:inline-block; width:6px; height:6px; border-radius:50%; background:var(--lime); margin-right:7px; box-shadow:0 0 0 3px rgba(201,242,107,.1); }
  main { min-width:0; }
  .topbar { height:58px; border-bottom:1px solid var(--line); background:rgba(255,255,255,.82); backdrop-filter:blur(12px); display:flex; align-items:center; justify-content:space-between; padding:0 clamp(24px,4vw,54px); color:var(--sub); font-size:12px; }
  .crumb { color:var(--ink); font-weight:650; }
  .proof { display:flex; align-items:center; gap:7px; }
  .proof:before { content:""; width:7px; height:7px; border-radius:50%; background:#4e9f6c; }
  .page { max-width:1480px; padding:38px clamp(24px,4vw,54px) 72px; margin:auto; }
  .eyebrow { color:var(--green); text-transform:uppercase; letter-spacing:.14em; font-size:10px; font-weight:800; margin-bottom:9px; }
  h1 { font:500 clamp(30px,3vw,42px)/1.12 Georgia,"Times New Roman",serif; letter-spacing:-.035em; margin:0; }
  h2 { font:600 20px/1.3 Georgia,"Times New Roman",serif; letter-spacing:-.02em; margin:0; }
  h3 { font-size:14px; margin:0; }
  p { margin:0; }
  .subtitle { color:var(--sub); font-size:15px; max-width:720px; margin-top:9px; }
  .heading-row { display:flex; align-items:flex-end; justify-content:space-between; gap:30px; margin-bottom:28px; }
  .picker { display:flex; gap:8px; align-items:center; }
  select,.button { border:1px solid var(--line-strong); border-radius:8px; background:white; color:var(--ink); height:38px; padding:0 11px; font:inherit; box-shadow:0 1px 2px rgba(0,0,0,.03); }
  select { max-width:320px; }
  .button { cursor:pointer; font-weight:650; }
  .button:hover { border-color:#92a398; }
  .card { background:var(--white); border:1px solid var(--line); border-radius:12px; box-shadow:var(--shadow); }
  .session-hero { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(300px,.7fr); overflow:hidden; margin-bottom:16px; }
  .session-main { padding:25px 27px; }
  .session-side { border-left:1px solid var(--line); padding:23px 24px; background:#fafbf9; }
  .status-line { display:flex; flex-wrap:wrap; gap:7px; align-items:center; margin-bottom:14px; }
  .session-id { font:600 21px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:-.04em; overflow-wrap:anywhere; }
  .meta-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; margin-top:23px; }
  .meta-label,.metric-label { color:var(--sub); font-size:10px; text-transform:uppercase; letter-spacing:.11em; font-weight:750; margin-bottom:5px; }
  .meta-value { font-weight:620; min-height:21px; }
  .muted-value { color:#8a968e; font-weight:500; }
  .side-title { color:var(--sub); font-size:11px; font-weight:750; text-transform:uppercase; letter-spacing:.1em; margin-bottom:12px; }
  .source-row { display:flex; justify-content:space-between; gap:18px; padding:8px 0; border-bottom:1px solid #e7ebe8; }
  .source-row:last-child { border:0; }
  .source-row span { color:var(--sub); }
  .source-row strong { text-align:right; font-weight:620; }
  .metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); margin-bottom:30px; overflow:hidden; }
  .metric { padding:17px 18px; border-right:1px solid var(--line); min-width:0; }
  .metric:last-child { border-right:0; }
  .metric-value { font-size:22px; font-weight:620; letter-spacing:-.04em; }
  .metric-value.small { font-size:13px; padding-top:6px; color:#89958d; letter-spacing:0; }
  .section-head { display:flex; align-items:end; justify-content:space-between; gap:20px; margin:30px 0 13px; }
  .section-head p { color:var(--sub); font-size:12px; }
  .content-grid { display:grid; grid-template-columns:minmax(0,1fr) 310px; gap:18px; align-items:start; }
  .turns { display:grid; gap:12px; }
  .turn { overflow:hidden; }
  .turn-head { min-height:48px; padding:12px 17px; border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between; background:#fbfcfa; }
  .turn-number { display:flex; align-items:center; gap:9px; font-weight:700; }
  .turn-number span { width:23px; height:23px; border-radius:7px; display:grid; place-items:center; background:#e8eee9; color:#42604e; font-size:11px; }
  .turn-topic { color:var(--sub); font-size:12px; }
  .messages { padding:16px 17px 7px; display:grid; gap:10px; }
  .message { display:grid; grid-template-columns:74px minmax(0,1fr); gap:12px; align-items:start; }
  .speaker { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:var(--sub); font-weight:750; padding-top:7px; }
  .bubble { border:1px solid var(--line); border-radius:9px; padding:11px 13px; white-space:pre-wrap; overflow-wrap:anywhere; background:#fafbf9; max-height:220px; overflow:auto; }
  .message.output .bubble { background:#f1f6f2; border-color:#d6e3d9; }
  .empty-content { color:#89958d; font-style:italic; }
  .steps { margin:8px 17px 17px 103px; border-left:1px solid var(--line-strong); padding-left:14px; display:grid; gap:7px; }
  details.step { border:1px solid var(--line); border-radius:9px; background:white; }
  details.step summary { list-style:none; cursor:pointer; padding:10px 12px; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:10px; align-items:center; }
  details.step summary::-webkit-details-marker { display:none; }
  .step-kind { font-size:9px; letter-spacing:.08em; font-weight:800; padding:4px 6px; border-radius:5px; background:#eef1ee; color:#647069; }
  .step-kind.LLM_STEP { background:var(--blue-soft); color:var(--blue); }
  .step-kind.ACTION_STEP { background:var(--amber-soft); color:var(--amber); }
  .step-name { font-weight:620; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .step-body { border-top:1px solid var(--line); padding:12px; background:#fafbf9; }
  .step-link { color:var(--sub); font:11px ui-monospace,SFMono-Regular,Menlo,monospace; margin-bottom:10px; overflow-wrap:anywhere; }
  .io-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
  .io h4 { margin:0 0 5px; color:var(--sub); text-transform:uppercase; letter-spacing:.09em; font-size:9px; }
  pre { margin:0; border:1px solid var(--line); background:white; border-radius:7px; padding:9px; max-height:280px; overflow:auto; white-space:pre-wrap; overflow-wrap:anywhere; font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace; color:#3c4840; }
  .rail { display:grid; gap:12px; position:sticky; top:76px; }
  .rail-card { padding:18px; }
  .participant { display:flex; gap:11px; padding:10px 0; border-bottom:1px solid var(--line); }
  .participant:last-child { border:0; }
  .avatar { width:30px; height:30px; border-radius:8px; background:#e8eee9; display:grid; place-items:center; color:#466050; font-size:10px; font-weight:800; flex:none; }
  .participant strong { display:block; }
  .participant small { color:var(--sub); }
  .detection { padding:10px 0; border-bottom:1px solid var(--line); }
  .detection:last-child { border:0; }
  .detection strong { display:block; margin-bottom:3px; }
  .detection p { color:var(--sub); font-size:12px; }
  .replay-check { display:flex; align-items:flex-start; gap:8px; padding:7px 0; color:var(--sub); font-size:12px; }
  .replay-check:before { content:"✓"; color:var(--green); font-weight:800; }
  .badge { display:inline-flex; align-items:center; gap:6px; border-radius:999px; padding:4px 8px; font-size:10px; font-weight:720; white-space:nowrap; background:#eef1ee; color:#657068; }
  .badge-dot { width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.8; }
  .badge.green { background:var(--green-soft); color:var(--green); }
  .badge.amber { background:var(--amber-soft); color:var(--amber); }
  .badge.red { background:var(--red-soft); color:var(--red); }
  .badge.blue { background:var(--blue-soft); color:var(--blue); }
  .inventory-summary { display:grid; grid-template-columns:repeat(4,1fr); overflow:hidden; margin:25px 0 18px; }
  .summary-stat { padding:22px 24px; border-right:1px solid var(--line); }
  .summary-stat:last-child { border:0; }
  .summary-stat strong { display:block; font-size:27px; letter-spacing:-.04em; font-weight:620; }
  .summary-stat span { color:var(--sub); font-size:12px; }
  .table-card { overflow:hidden; }
  table { width:100%; border-collapse:collapse; }
  th { text-align:left; padding:11px 15px; background:#fafbf9; border-bottom:1px solid var(--line); color:var(--sub); font-size:9px; letter-spacing:.1em; text-transform:uppercase; }
  td { padding:15px; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:last-child td { border:0; }
  .agent-cell { display:flex; gap:11px; min-width:180px; }
  .agent-glyph { width:34px; height:34px; border-radius:9px; background:#1d3527; color:var(--lime); display:grid; place-items:center; font-weight:800; flex:none; }
  .agent-cell strong { display:block; }
  .agent-cell code { color:var(--sub); font-size:11px; }
  .volume { min-width:110px; }
  .volume strong { font-size:16px; }
  .bar { margin-top:7px; width:100%; height:4px; background:#e8ece9; border-radius:99px; overflow:hidden; }
  .bar i { display:block; height:100%; background:#60836b; border-radius:99px; }
  .posture { display:flex; flex-wrap:wrap; gap:5px; max-width:190px; }
  .note { color:var(--sub); font-size:12px; }
  .narrative { padding:22px 25px; display:grid; grid-template-columns:auto minmax(0,1fr); gap:17px; align-items:start; margin:24px 0 17px; background:#edf4ee; border-color:#d1dfd4; }
  .narrative-mark { width:31px; height:31px; border-radius:50%; display:grid; place-items:center; background:#1c3827; color:var(--lime); font-weight:800; }
  .narrative p { color:#4d6254; margin-top:3px; }
  .behavior-grid { display:grid; grid-template-columns:1.05fr .95fr; gap:17px; margin-top:17px; }
  .ledger { overflow:hidden; }
  .ledger-head { padding:17px 19px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; }
  .ledger-list { max-height:530px; overflow:auto; }
  .ledger-item { padding:14px 19px; border-bottom:1px solid var(--line); }
  .ledger-item:last-child { border:0; }
  .ledger-top { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:5px; }
  .ledger-item p { color:var(--sub); font-size:12px; }
  .ledger-item a { color:var(--green); font-weight:650; text-decoration:none; }
  .quote { border-left:2px solid #b8c8bd; padding-left:10px; margin-top:9px; color:#4f5e55; font-size:12px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; white-space:pre-wrap; }
  .tool-name { font:620 12px ui-monospace,SFMono-Regular,Menlo,monospace; }
  .empty { padding:38px; text-align:center; color:var(--sub); }
  .error-page { min-height:calc(100vh - 190px); display:grid; place-items:center; }
  .error-card { max-width:580px; padding:40px; text-align:center; }
  .error-icon { width:44px; height:44px; border-radius:50%; background:var(--red-soft); color:var(--red); display:grid; place-items:center; margin:0 auto 16px; font-weight:800; }
  .error-card p { color:var(--sub); margin:9px auto 18px; max-width:430px; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  @media (max-width:1050px) { .metrics { grid-template-columns:repeat(4,1fr); } .metric:nth-child(4) { border-right:0; } .metric:nth-child(-n+4) { border-bottom:1px solid var(--line); } .content-grid { grid-template-columns:1fr; } .rail { position:static; grid-template-columns:repeat(3,1fr); } .behavior-grid { grid-template-columns:1fr; } .table-card { overflow:auto; } }
  @media (max-width:760px) { .app { display:block; } .sidebar { position:static; height:auto; min-height:0; padding:15px; } .brand { padding-bottom:14px; } .nav-label,.source-lockup { display:none; } nav { grid-template-columns:repeat(3,1fr); } nav a { justify-content:center; font-size:11px; padding:9px 5px; } nav a:before { display:none; } .topbar { display:none; } .page { padding-top:24px; } .heading-row { display:block; } .picker { margin-top:18px; align-items:stretch; } select { min-width:0; width:100%; } .session-hero { grid-template-columns:1fr; } .session-side { border-left:0; border-top:1px solid var(--line); } .metrics,.inventory-summary { grid-template-columns:repeat(2,1fr); } .metric,.summary-stat { border-bottom:1px solid var(--line); } .meta-grid { grid-template-columns:1fr 1fr; } .content-grid { display:block; } .rail { margin-top:12px; display:grid; grid-template-columns:1fr; } .steps { margin-left:17px; } .message { grid-template-columns:1fr; gap:3px; } .speaker { padding:0; } .io-grid { grid-template-columns:1fr; } .behavior-grid { display:block; } .ledger { margin-bottom:13px; } }
`;

function layout(active: ScreenRoute, title: string, body: string): string {
  const items: Array<[ScreenRoute, string]> = [
    ["/session-audit", "Session audit"],
    ["/org-agents", "Org agents"],
    ["/enterprise-acting", "Enterprise acting"],
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Keel</title><style>${styles}</style></head>
<body><div class="app"><aside class="sidebar"><div class="brand"><span class="mark" aria-hidden="true"></span>Keel</div><div class="nav-label">Observability</div><nav aria-label="Primary">${items.map(([route, label]) => `<a href="${route}"${route === active ? ' class="active" aria-current="page"' : ""}>${label}</a>`).join("")}</nav><div class="source-lockup"><strong>Evidence connected</strong>CoVe-12k through MinIO</div></aside><main><div class="topbar"><span class="crumb">kneel-factory / ${escapeHtml(title)}</span><span class="proof">Source-backed · read only</span></div>${body}</main></div></body></html>`;
}

function pageHeading(eyebrow: string, title: string, subtitle: string, controls = ""): string {
  return `<div class="heading-row"><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></div>${controls}</div>`;
}

function metric(label: string, value: number | string, unavailable = false): string {
  return `<div class="metric"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-value${unavailable ? " small" : ""}">${escapeHtml(value)}</div></div>`;
}

function renderStep(step: AiAgentInteractionStep): string {
  const outcome = step.AiAgentInteractionStepType === "ACTION_STEP" ? actionOutcome(step) : null;
  const label = step.Name ? humanize(step.Name) : step.AiAgentInteractionStepType === "LLM_STEP" ? "Agent generation" : "Unlabeled step";
  return `<details class="step"><summary><span class="step-kind ${step.AiAgentInteractionStepType}">${step.AiAgentInteractionStepType}</span><span class="step-name">${escapeHtml(label)}</span>${outcome ? outcomeBadge(outcome) : ""}</summary><div class="step-body"><div class="step-link">Previous step: ${step.PrevStepId ? escapeHtml(shortId(step.PrevStepId)) : "None · interaction root"}</div><div class="io-grid"><div class="io"><h4>Exact input</h4><pre>${step.InputValueText === null ? "Not recorded" : escapeHtml(step.InputValueText)}</pre></div><div class="io"><h4>Exact output</h4><pre>${step.OutputValueText === null ? "Not recorded" : escapeHtml(step.OutputValueText)}</pre></div></div>${step.ErrorMessageText ? `<div class="io" style="margin-top:9px"><h4>Recorded error</h4><pre>${escapeHtml(step.ErrorMessageText)}</pre></div>` : ""}</div></details>`;
}

function renderTurn(record: KeelSessionRecord, interaction: AiAgentInteraction, index: number): string {
  const messages = record.AiAgentInteractionMessage.filter((message) => message.AiAgentInteractionId === interaction.Id);
  const steps = record.AiAgentInteractionStep.filter((step) => step.AiAgentInteractionId === interaction.Id);
  return `<article class="turn card"><div class="turn-head"><div class="turn-number"><span>${index + 1}</span>Interaction</div><div class="turn-topic">${escapeHtml(humanize(interaction.TopicApiName))} · ${messages.length} messages · ${steps.length} steps</div></div><div class="messages">${messages.map((message) => `<div class="message ${message.AiAgentInteractionMessageType === "Output" ? "output" : "input"}"><div class="speaker">${message.AiAgentInteractionMessageType === "Input" ? "User" : "Agent"}</div><div class="bubble">${message.ContentText === null ? '<span class="empty-content">No text · tool decision recorded below</span>' : escapeHtml(message.ContentText)}</div></div>`).join("")}</div><div class="steps">${steps.map(renderStep).join("")}</div></article>`;
}

export function renderSessionAudit(records: KeelSessionRecord[], selectedId?: string): string {
  const record = records.find((candidate) => candidate.AiAgentSession.Id === selectedId) ?? records[0];
  if (!record) return renderError("/session-audit", "Session audit", "No session objects were listed in the MinIO manifest.");
  const agent = record.AiAgentSessionParticipant.find((participant) => participant.AiAgentSessionParticipantRole === "AGENT");
  const actions = record.AiAgentInteractionStep.filter((step) => step.AiAgentInteractionStepType === "ACTION_STEP");
  const llmSteps = record.AiAgentInteractionStep.filter((step) => step.AiAgentInteractionStepType === "LLM_STEP");
  const topicSteps = record.AiAgentInteractionStep.filter((step) => step.AiAgentInteractionStepType === "TOPIC_STEP");
  const evidence = enterpriseEvidence([record]);
  const completeActions = actions.filter((step) => step.InputValueText !== null && step.OutputValueText !== null).length;
  const controls = `<form class="picker" method="get" action="/session-audit"><label class="meta-label" for="session">Session</label><select id="session" name="session">${records.map((candidate) => `<option value="${escapeHtml(candidate.AiAgentSession.Id)}"${candidate === record ? " selected" : ""}>Row ${candidate.source.rowIndex} · ${escapeHtml(humanize(candidate.AiAgentSessionParticipant.find((participant) => participant.AiAgentSessionParticipantRole === "AGENT")?.AiAgentApiName ?? null))}</option>`).join("")}</select><button class="button" type="submit">Open</button></form>`;
  const body = `<div class="page">${pageHeading("Forensic record", "Session audit", "Every observed turn, model decision, action, and outcome in one replayable chain.", controls)}
    <section class="session-hero card"><div class="session-main"><div class="status-line">${badge("Loaded from MinIO", "green")}${record.AiAgentSession.AiAgentSessionEndType ? badge(humanize(record.AiAgentSession.AiAgentSessionEndType), "blue") : badge("End not recorded")}</div><div class="session-id">${escapeHtml(shortId(record.AiAgentSession.Id))}</div><div class="meta-grid"><div><div class="meta-label">Agent</div><div class="meta-value">${escapeHtml(humanize(agent?.AiAgentApiName ?? null))}</div></div><div><div class="meta-label">Channel</div><div class="meta-value">${recorded(record.AiAgentSession.AiAgentChannelType)}</div></div><div><div class="meta-label">Time window</div><div class="meta-value">${recorded(record.AiAgentSession.StartTimestamp)}</div></div><div><div class="meta-label">Agent version</div><div class="meta-value">${recorded(agent?.AiAgentVersionApiName)}</div></div><div><div class="meta-label">Participants</div><div class="meta-value">${record.AiAgentSessionParticipant.length}</div></div><div><div class="meta-label">End type</div><div class="meta-value">${recorded(record.AiAgentSession.AiAgentSessionEndType)}</div></div></div></div><div class="session-side"><div class="side-title">Evidence provenance</div><div class="source-row"><span>Dataset</span><strong>${escapeHtml(record.source.dataset)}</strong></div><div class="source-row"><span>Split / row</span><strong>${escapeHtml(record.source.split)} / ${record.source.rowIndex}</strong></div><div class="source-row"><span>Integrity</span><strong><code>${escapeHtml(record.AiAgentSession.Id.split("/").at(-1))}</code></strong></div><div class="source-row"><span>Storage</span><strong>S3 object</strong></div></div></section>
    <section class="metrics card" aria-label="Session evidence totals">${metric("Interactions", record.AiAgentInteraction.length)}${metric("Messages", record.AiAgentInteractionMessage.length)}${metric("LLM steps", llmSteps.length)}${metric("Actions", actions.length)}${metric("Topic steps", topicSteps.length)}${metric("Evaluations", "Not recorded", true)}${metric("Cost / tokens", "Not recorded", true)}${metric("Latency", "Not recorded", true)}</section>
    <div class="content-grid"><section><div class="section-head"><div><div class="eyebrow">Ordered evidence</div><h2>Interaction timeline</h2></div><p>${record.AiAgentInteraction.length} turns · previous-step links preserved</p></div><div class="turns">${record.AiAgentInteraction.map((interaction, index) => renderTurn(record, interaction, index)).join("")}</div></section><aside class="rail"><section class="rail-card card"><div class="side-title">Participants</div>${record.AiAgentSessionParticipant.map((participant) => `<div class="participant"><div class="avatar">${participant.AiAgentSessionParticipantRole.slice(0, 1)}</div><div><strong>${participant.AiAgentSessionParticipantRole}</strong><small>${participant.AiAgentApiName ? escapeHtml(participant.AiAgentApiName) : "Identity not recorded"}</small></div></div>`).join("")}</section><section class="rail-card card"><div class="side-title">Detections</div><div class="detection"><strong>${evidence.writes.length} system writes</strong><p>Mutating action names observed in this trajectory.</p></div><div class="detection"><strong>${evidence.approvals.length} confirmed writes</strong><p>Request + affirmative user evidence found before action.</p></div><div class="detection"><strong>${evidence.handoffs.length} handoffs</strong><p>Transfer or escalation tools observed.</p></div><div class="detection"><strong>${evidence.policies.length} policy gates / stops</strong><p>Grounded in agent message text.</p></div></section><section class="rail-card card"><div class="side-title">Replay manifest</div><div class="replay-check">Source trajectory integrity hash retained</div><div class="replay-check">${record.AiAgentInteraction.length} interactions ordered</div><div class="replay-check">${completeActions} of ${actions.length} action inputs and results complete</div><div class="replay-check">Read only · no enterprise actions fired</div></section></aside></div></div>`;
  return layout("/session-audit", "Session audit", body);
}

export function renderOrgAgents(records: KeelSessionRecord[]): string {
  const agents = agentSummaries(records);
  if (agents.length === 0) return renderError("/org-agents", "Org agents", "No AGENT participants were found in the loaded MinIO sessions.");
  const totalTurns = records.reduce((sum, record) => sum + record.AiAgentInteraction.length, 0);
  const totalActions = records.reduce((sum, record) => sum + record.AiAgentInteractionStep.filter((step) => step.AiAgentInteractionStepType === "ACTION_STEP").length, 0);
  const maxSessions = Math.max(...agents.map((agent) => agent.sessions));
  const body = `<div class="page">${pageHeading("Organization inventory", "Agents in the organization", "Identity and operating posture from observed sessions—not configuration guesses or a prompt playground.")}
    <section class="inventory-summary card"><div class="summary-stat"><strong>${agents.length}</strong><span>Source-backed agents</span></div><div class="summary-stat"><strong>${records.length}</strong><span>Loaded sessions</span></div><div class="summary-stat"><strong>${totalTurns}</strong><span>Observed turns</span></div><div class="summary-stat"><strong>${totalActions}</strong><span>Actions fired</span></div></section>
    <div class="section-head"><div><div class="eyebrow">Observed identities</div><h2>Agent inventory</h2></div><p>Volume reflects only the seeded golden slice</p></div>
    <section class="table-card card"><table><thead><tr><th>Agent identity</th><th>Version / owner</th><th>Channel / last seen</th><th>Volume</th><th>Action posture</th></tr></thead><tbody>${agents.map((agent) => `<tr><td><div class="agent-cell"><div class="agent-glyph">${escapeHtml(agent.identity.slice(0, 1).toUpperCase())}</div><div><strong>${escapeHtml(humanize(agent.identity))}</strong><code>${escapeHtml(agent.identity)}</code></div></div></td><td><strong>${recorded(agent.version)}</strong><div class="note">Owner · <span class="muted-value">Unassigned</span></div></td><td><strong>${agent.channels.length ? escapeHtml(agent.channels.map(humanize).join(", ")) : '<span class="muted-value">Not recorded</span>'}</strong><div class="note">Last seen · ${recorded(agent.lastSeen)}</div></td><td><div class="volume"><strong>${agent.sessions} sessions</strong><div class="note">${agent.interactions} turns · ${agent.messages} messages · ${agent.actions} actions</div><div class="bar"><i style="width:${Math.round((agent.sessions / maxSessions) * 100)}%"></i></div></div></td><td><div class="posture">${badge(`${agent.distinctTools} tools`, "blue")}${badge(`${agent.writes} writes`, agent.writes ? "amber" : "neutral")}${badge(`${agent.handoffs} handoffs`, agent.handoffs ? "green" : "neutral")}${badge(`${agent.policyGates} gates`, agent.policyGates ? "red" : "neutral")}</div></td></tr>`).join("")}</tbody></table></section>
  </div>`;
  return layout("/org-agents", "Org agents", body);
}

function sessionLink(action: ActionEvidence): string {
  return `/session-audit?session=${encodeURIComponent(action.record.AiAgentSession.Id)}`;
}

function actionLedgerItem(action: ActionEvidence, showPayload = false): string {
  return `<div class="ledger-item"><div class="ledger-top"><span class="tool-name">${escapeHtml(action.step.Name ?? "Unnamed action")}</span>${outcomeBadge(action.outcome)}</div><p>${escapeHtml(humanize(action.agent))} · ${escapeHtml(humanize(action.system))} · <a href="${sessionLink(action)}">Session row ${action.record.source.rowIndex}</a></p>${showPayload ? `<details style="margin-top:8px"><summary class="note">Inspect exact I/O</summary><div class="io-grid" style="margin-top:8px"><pre>${action.step.InputValueText === null ? "Not recorded" : escapeHtml(action.step.InputValueText)}</pre><pre>${action.step.OutputValueText === null ? "Not recorded" : escapeHtml(action.step.OutputValueText)}</pre></div></details>` : ""}</div>`;
}

export function renderEnterpriseActing(records: KeelSessionRecord[]): string {
  const evidence = enterpriseEvidence(records);
  const failures = evidence.actions.filter((action) => action.outcome === "failed").length;
  const unknown = evidence.actions.filter((action) => action.outcome === "not-recorded").length;
  const tools = new Map<string, ActionEvidence[]>();
  for (const action of evidence.actions) {
    const name = action.step.Name ?? "Not recorded";
    tools.set(name, [...(tools.get(name) ?? []), action]);
  }
  const rankedTools = [...tools.entries()].sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
  const body = `<div class="page">${pageHeading("Enterprise behavior", "How agents act", "Consequential behavior across systems, grounded in tool calls, participant messages, and recorded results.")}
    <section class="narrative card"><div class="narrative-mark">K</div><div><h3>Operating readout</h3><p>Across ${records.length} loaded sessions, agents fired ${evidence.actions.length} actions. ${evidence.writes.length} were classified as system writes from their observed tool names; ${evidence.approvals.length} have paired human approval evidence. ${evidence.handoffs.length} handoffs, ${failures} failures, and ${unknown} unknown outcomes remain visible in the audit chain.</p></div></section>
    <section class="metrics card">${metric("Tools fired", evidence.actions.length)}${metric("Distinct tools", tools.size)}${metric("System writes", evidence.writes.length)}${metric("HITL approvals", evidence.approvals.length)}${metric("Handoffs", evidence.handoffs.length)}${metric("Policy gates", evidence.policies.length)}${metric("Failures", failures)}</section>
    <div class="section-head"><div><div class="eyebrow">Action surface</div><h2>Tool register</h2></div><p>Ranked by observed fire count</p></div>
    <section class="table-card card"><table><thead><tr><th>Tool</th><th>Agent / system</th><th>Posture</th><th>Fires</th><th>Completed</th><th>Failed</th><th>Unknown</th></tr></thead><tbody>${rankedTools.map(([name, actions]) => `<tr><td class="tool-name">${escapeHtml(name)}</td><td><strong>${escapeHtml(humanize(actions[0]?.agent ?? null))}</strong><div class="note">${escapeHtml(humanize(actions[0]?.system ?? null))}</div></td><td>${badge(actions.some((action) => action.posture === "write") ? "System write" : "Read", actions.some((action) => action.posture === "write") ? "amber" : "blue")}</td><td><strong>${actions.length}</strong></td><td>${actions.filter((action) => action.outcome === "completed").length}</td><td>${actions.filter((action) => action.outcome === "failed").length}</td><td>${actions.filter((action) => action.outcome === "not-recorded").length}</td></tr>`).join("")}</tbody></table></section>
    <div class="behavior-grid"><section class="ledger card"><div class="ledger-head"><h2>System writes</h2>${badge(`${evidence.writes.length} observed`, "amber")}</div><div class="ledger-list">${evidence.writes.length ? evidence.writes.map((action) => actionLedgerItem(action, true)).join("") : '<div class="empty">No mutating action names were observed.</div>'}</div></section><section class="ledger card"><div class="ledger-head"><h2>Human in the loop</h2>${badge(`${evidence.approvals.length} proven`, "green")}</div><div class="ledger-list">${evidence.approvals.length ? evidence.approvals.map((approval) => `<div class="ledger-item"><div class="ledger-top"><span class="tool-name">${escapeHtml(approval.action.step.Name ?? "Unnamed action")}</span>${badge("Approval paired", "green")}</div><p><a href="${sessionLink(approval.action)}">Session row ${approval.action.record.source.rowIndex}</a> · ${escapeHtml(humanize(approval.action.agent))}</p><div class="quote">Agent gate: ${escapeHtml(approval.request.ContentText)}</div><div class="quote">User approval: ${escapeHtml(approval.approval.ContentText)}</div></div>`).join("") : '<div class="empty">No request + affirmative response pair was proven before a write.</div>'}</div></section></div>
    <div class="behavior-grid"><section class="ledger card"><div class="ledger-head"><h2>Handoffs</h2>${badge(`${evidence.handoffs.length} observed`, "blue")}</div><div class="ledger-list">${evidence.handoffs.length ? evidence.handoffs.map((action) => actionLedgerItem(action, true)).join("") : '<div class="empty">No transfer, handoff, or escalation action was observed.</div>'}</div></section><section class="ledger card"><div class="ledger-head"><h2>Policy stops &amp; gates</h2>${badge(`${evidence.policies.length} detected`, "red")}</div><div class="ledger-list">${evidence.policies.length ? evidence.policies.map((policy) => `<div class="ledger-item"><div class="ledger-top"><strong>${policy.kind === "policy-stop" ? "Policy stop" : "Confirmation gate"}</strong>${badge(policy.kind === "policy-stop" ? "Stopped" : "Gated", policy.kind === "policy-stop" ? "red" : "amber")}</div><p>${escapeHtml(humanize(policy.record.AiAgentSessionParticipant.find((participant) => participant.AiAgentSessionParticipantRole === "AGENT")?.AiAgentApiName ?? null))} · <a href="/session-audit?session=${encodeURIComponent(policy.record.AiAgentSession.Id)}">Session row ${policy.record.source.rowIndex}</a></p><div class="quote">${escapeHtml(policy.message.ContentText)}</div></div>`).join("") : '<div class="empty">No policy boundary language was detected.</div>'}</div></section></div>
  </div>`;
  return layout("/enterprise-acting", "Enterprise acting", body);
}

export function renderError(active: ScreenRoute, title: string, message: string): string {
  const body = `<div class="page"><div class="error-page"><section class="error-card card"><div class="error-icon">!</div><div class="eyebrow">Evidence unavailable</div><h1>Load failed closed</h1><p>${escapeHtml(message)}</p>${badge("No fixture fallback", "red")}</section></div></div>`;
  return layout(active, title, body);
}
