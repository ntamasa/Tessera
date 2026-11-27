#!/usr/bin/env node
// Jira Cloud REST client for the factory skills. Node 18+, no dependencies.
// Config comes from the project's .env at the git root (see ../SKILL.md).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, resolve, basename } from "node:path";

const MAX_FIELD = 32767; // Jira Cloud limit for a rich-text field, checked against the ADF JSON
const KEY_RE = /^[A-Z][A-Z0-9_]+-\d+$/;
const ISSUE_FIELDS = "summary,description,status,issuetype,parent,issuelinks,attachment,subtasks,labels";

// ---------------------------------------------------------------- basics

function die(msg) {
  console.error(`jira: ${msg}`);
  process.exit(1);
}

if (Number(process.versions.node.split(".")[0]) < 18) die(`Node 18+ required, found ${process.versions.node}`);

const ROOT = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return process.cwd();
  }
})();

function readEnvFile() {
  const file = join(ROOT, ".env");
  const vars = {};
  if (!existsSync(file)) return vars;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    vars[m[1]] = v;
  }
  return vars;
}

let CFG = null;
function config() {
  if (CFG) return CFG;
  const env = { ...process.env, ...readEnvFile() }; // the project's .env wins
  const required = ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) die(`missing ${missing.join(", ")} in ${join(ROOT, ".env")}`);
  CFG = {
    base: env.JIRA_BASE_URL.replace(/\/+$/, ""),
    auth: "Basic " + Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64"),
    project: env.JIRA_PROJECT_KEY,
    pointsField: env.JIRA_STORY_POINTS_FIELD || null,
  };
  return CFG;
}

async function api(method, path, body) {
  const cfg = config();
  const isForm = body instanceof FormData;
  const headers = { Authorization: cfg.auth, Accept: "application/json" };
  if (body && !isForm) headers["Content-Type"] = "application/json";
  if (isForm) headers["X-Atlassian-Token"] = "no-check";
  const res = await fetch(cfg.base + path, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 500);
    try {
      const j = JSON.parse(text);
      const parts = [...(j.errorMessages || []), ...Object.entries(j.errors || {}).map(([k, v]) => `${k}: ${v}`)];
      if (parts.length) detail = parts.join("; ");
    } catch {}
    die(`${method} ${path} -> ${res.status} ${detail}`);
  }
  return text ? JSON.parse(text) : null;
}

function parseArgs(argv, booleans = []) {
  const pos = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const name = a.slice(2);
      if (booleans.includes(name)) opts[name] = true;
      else {
        if (i + 1 >= argv.length) die(`--${name} needs a value`);
        opts[name] = argv[++i];
      }
    } else pos.push(a);
  }
  return { pos, opts };
}

const browse = (key) => `${config().base}/browse/${key}`;

// ---------------------------------------------------------------- Markdown -> ADF

const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const FENCE_RE = /^\s*(```|~~~)\s*([\w+#.-]*)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function mdToAdf(md) {
  return { version: 1, type: "doc", content: parseBlocks(md.replace(/\r\n?/g, "\n").split("\n")) };
}

function startsBlock(line, next) {
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    RULE_RE.test(line) ||
    LIST_RE.test(line) ||
    /^\s*>/.test(line) ||
    (/^\s*\|/.test(line) && next !== undefined && TABLE_SEP_RE.test(next))
  );
}

function parseBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    let m = line.match(FENCE_RE);
    if (m) {
      const fence = m[1];
      const body = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
      i++;
      const node = { type: "codeBlock", content: body.length ? [{ type: "text", text: body.join("\n") }] : [] };
      if (m[2]) node.attrs = { language: m[2] };
      out.push(node);
      continue;
    }
    m = line.match(HEADING_RE);
    if (m) {
      out.push({ type: "heading", attrs: { level: m[1].length }, content: inline(m[2]) });
      i++;
      continue;
    }
    if (RULE_RE.test(line)) {
      out.push({ type: "rule" });
      i++;
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      out.push({ type: "blockquote", content: parseBlocks(body) });
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1])) {
      const header = tableCells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(tableCells(lines[i++]));
      out.push(tableNode(header, rows));
      continue;
    }
    if (LIST_RE.test(line)) {
      const [node, next] = parseList(lines, i);
      out.push(node);
      i = next;
      continue;
    }
    const para = [line.trim()];
    i++;
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1])) para.push(lines[i++].trim());
    out.push({ type: "paragraph", content: inline(para.join(" ")) });
  }
  return out;
}

function tableCells(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

function tableNode(header, rows) {
  const cell = (type, text) => ({ type, attrs: {}, content: [{ type: "paragraph", content: inline(text) }] });
  const width = header.length;
  return {
    type: "table",
    attrs: { isNumberColumnEnabled: false, layout: "default" },
    content: [
      { type: "tableRow", content: header.map((h) => cell("tableHeader", h)) },
      ...rows.map((r) => ({
        type: "tableRow",
        content: Array.from({ length: width }, (_, k) => cell("tableCell", r[k] ?? "")),
      })),
    ],
  };
}

function indentOf(line) {
  return line.match(/^\s*/)[0].replace(/\t/g, "    ").length;
}

function parseList(lines, start) {
  const first = lines[start].match(LIST_RE);
  const indent = indentOf(lines[start]);
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j >= lines.length) break;
      const nm = lines[j].match(LIST_RE);
      const sameList = nm && indentOf(lines[j]) === indent && /\d/.test(nm[2]) === ordered;
      if (sameList || indentOf(lines[j]) > indent) {
        i = j;
        continue;
      }
      break;
    }
    const m = line.match(LIST_RE);
    const ind = indentOf(line);
    if (m && ind === indent) {
      if (/\d/.test(m[2]) !== ordered) break;
      items.push({ text: [m[3]], children: [] });
      i++;
    } else if (m && ind > indent && items.length) {
      const [child, next] = parseList(lines, i);
      items[items.length - 1].children.push(child);
      i = next;
    } else if (!m && ind > indent && items.length) {
      items[items.length - 1].text.push(line.trim());
      i++;
    } else break;
  }
  const node = {
    type: ordered ? "orderedList" : "bulletList",
    content: items.map((it) => {
      let text = it.text.join(" ");
      text = text.replace(/^\[ \]\s+/, "☐ ").replace(/^\[[xX]\]\s+/, "☑ ");
      return { type: "listItem", content: [{ type: "paragraph", content: inline(text) }, ...it.children] };
    }),
  };
  if (ordered) node.attrs = { order: parseInt(first[2], 10) || 1 };
  return [node, i];
}

const INLINE_RE =
  /(`+)([\s\S]*?[^`])\1(?!`)|\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([\s\S]+?)\*\*|__([\s\S]+?)__|~~([\s\S]+?)~~|\*([^*\s](?:[^*]*?[^*\s])?)\*|(?<!\w)_([^_\s](?:[^_]*?[^_\s])?)_(?!\w)/g;

function withMark(marks, mark) {
  return marks.some((m) => m.type === mark.type) ? marks : [...marks, mark];
}

function pushText(nodes, text, marks, unescape = true) {
  if (unescape) text = text.replace(/\\([\\`*_{}\[\]()#+\-.!|~>])/g, "$1");
  if (!text) return;
  const node = { type: "text", text };
  if (marks.length) node.marks = marks;
  nodes.push(node);
}

function inline(text, marks = []) {
  const nodes = [];
  const re = new RegExp(INLINE_RE.source, "g");
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) pushText(nodes, text.slice(last, m.index), marks);
    if (m[1] !== undefined) pushText(nodes, m[2], [{ type: "code" }, ...marks.filter((x) => x.type === "link")], false);
    else if (m[3] !== undefined) nodes.push(...inline(m[3], withMark(marks, { type: "link", attrs: { href: m[4] } })));
    else if (m[5] !== undefined || m[6] !== undefined) nodes.push(...inline(m[5] ?? m[6], withMark(marks, { type: "strong" })));
    else if (m[7] !== undefined) nodes.push(...inline(m[7], withMark(marks, { type: "strike" })));
    else nodes.push(...inline(m[8] ?? m[9], withMark(marks, { type: "em" })));
    last = re.lastIndex;
  }
  if (last < text.length) pushText(nodes, text.slice(last), marks);
  return nodes;
}

// ---------------------------------------------------------------- ADF -> Markdown

function adfToMd(doc) {
  if (!doc) return "";
  if (typeof doc === "string") return doc;
  return blocksMd(doc.content || []).trim();
}

function blocksMd(nodes, indent = "") {
  return nodes.map((n) => blockMd(n, indent)).filter((s) => s !== "").join("\n\n");
}

function blockMd(n, indent) {
  const c = n.content || [];
  switch (n.type) {
    case "paragraph":
      return indent + inlineMd(c);
    case "heading":
      return "#".repeat(n.attrs?.level || 1) + " " + inlineMd(c);
    case "bulletList":
    case "orderedList":
      return listMd(n, indent);
    case "taskList":
      return c.map((t) => `${indent}- [${t.attrs?.state === "DONE" ? "x" : " "}] ${inlineMd(t.content || [])}`).join("\n");
    case "codeBlock":
      return "```" + (n.attrs?.language || "") + "\n" + c.map((t) => t.text || "").join("") + "\n```";
    case "blockquote":
      return blocksMd(c).split("\n").map((l) => "> " + l).join("\n");
    case "rule":
      return "---";
    case "table":
      return tableMd(n);
    case "mediaSingle":
    case "mediaGroup":
    case "media":
      return "[media]";
    case "expand":
    case "nestedExpand":
      return (n.attrs?.title ? `**${n.attrs.title}**\n\n` : "") + blocksMd(c, indent);
    default:
      return blocksMd(c, indent);
  }
}

function listMd(list, indent) {
  let num = list.attrs?.order || 1;
  return (list.content || [])
    .map((item) => {
      const marker = list.type === "orderedList" ? `${num++}. ` : "- ";
      const [firstBlock, ...rest] = item.content || [];
      const head = firstBlock && firstBlock.type === "paragraph" ? inlineMd(firstBlock.content || []) : "";
      const childIndent = indent + " ".repeat(marker.length);
      const restBlocks = firstBlock && firstBlock.type !== "paragraph" ? [firstBlock, ...rest] : rest;
      const tail = restBlocks.map((b) => blockMd(b, childIndent)).filter(Boolean).join("\n");
      return indent + marker + head + (tail ? "\n" + tail : "");
    })
    .join("\n");
}

function tableMd(t) {
  const rows = (t.content || []).map((r) =>
    (r.content || []).map((cell) => blocksMd(cell.content || []).replace(/\n+/g, " ").replace(/\|/g, "\\|")),
  );
  if (!rows.length) return "";
  const line = (r) => "| " + r.join(" | ") + " |";
  return [line(rows[0]), line(rows[0].map(() => "---")), ...rows.slice(1).map(line)].join("\n");
}

function inlineMd(nodes) {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text": {
          let s = n.text || "";
          const marks = n.marks || [];
          if (marks.some((m) => m.type === "code")) s = "`" + s + "`";
          if (marks.some((m) => m.type === "strong")) s = `**${s}**`;
          if (marks.some((m) => m.type === "em")) s = `*${s}*`;
          if (marks.some((m) => m.type === "strike")) s = `~~${s}~~`;
          const link = marks.find((m) => m.type === "link");
          if (link) s = `[${s}](${link.attrs?.href})`;
          return s;
        }
        case "hardBreak":
          return "\n";
        case "mention":
          return n.attrs?.text || "@user";
        case "emoji":
          return n.attrs?.text || n.attrs?.shortName || "";
        case "inlineCard":
          return n.attrs?.url || "";
        case "status":
          return `[${n.attrs?.text || ""}]`;
        default:
          return inlineMd(n.content || []);
      }
    })
    .join("");
}

// ---------------------------------------------------------------- Markdown sections

function extractSection(md, heading, source) {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const found = [];
  let inFence = false;
  lines.forEach((line, idx) => {
    if (FENCE_RE.test(line)) inFence = !inFence;
    if (inFence) return;
    const m = line.match(HEADING_RE);
    if (m && (m[2] === heading || m[2].startsWith(heading + " "))) found.push({ idx, level: m[1].length });
  });
  if (found.length === 0) throw new Error(`heading "${heading}" not found in ${source}`);
  if (found.length > 1) throw new Error(`heading "${heading}" matches ${found.length} headings in ${source}`);
  const { idx, level } = found[0];
  let end = lines.length;
  inFence = false;
  for (let j = idx + 1; j < lines.length; j++) {
    if (FENCE_RE.test(lines[j])) inFence = !inFence;
    if (inFence) continue;
    const m = lines[j].match(HEADING_RE);
    if (m && m[1].length <= level) {
      end = j;
      break;
    }
  }
  return lines.slice(idx, end).join("\n").trim();
}

// ---------------------------------------------------------------- Jira helpers

async function projectTypes() {
  const proj = await api("GET", `/rest/api/3/project/${encodeURIComponent(config().project)}`);
  const types = proj.issueTypes || [];
  const byName = (re) => types.find((t) => !t.subtask && re.test(t.name));
  return {
    all: types,
    epic: types.find((t) => t.hierarchyLevel === 1) || byName(/^epic$/i),
    story: byName(/^story$/i),
    bug: byName(/^bug$/i),
    task: byName(/^task$/i),
    subtask: types.find((t) => t.subtask),
  };
}

function typeId(types, name) {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  const t = types[key] || types.all.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!t) die(`issue type "${name}" not found in project ${config().project}. Run: jira.mjs check`);
  return t.id;
}

let POINTS;
async function storyPointsField(types) {
  if (POINTS !== undefined) return POINTS;
  const cfg = config();
  if (cfg.pointsField) return (POINTS = { id: cfg.pointsField, name: cfg.pointsField });
  types = types || (await projectTypes());
  POINTS = null;
  if (!types.story) return POINTS;
  const res = await api("GET", `/rest/api/3/issue/createmeta/${encodeURIComponent(cfg.project)}/issuetypes/${types.story.id}?maxResults=200`);
  const list = res.fields || res.values || [];
  const f = list.find((x) => /^story points?$/i.test(x.name)) || list.find((x) => /story point/i.test(x.name));
  if (f) POINTS = { id: f.fieldId || f.key, name: f.name };
  return POINTS;
}

function pointsValue(v, label) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label}: story points must be a positive number, got ${v}`);
  return n;
}

function adfField(md, label) {
  const adf = mdToAdf(md);
  const size = JSON.stringify(adf).length;
  if (size > MAX_FIELD) throw new Error(`${label}: description is ${size} chars as ADF, limit ${MAX_FIELD}`);
  return adf;
}

async function getIssue(key, fields = ISSUE_FIELDS) {
  return api("GET", `/rest/api/3/issue/${encodeURIComponent(key)}?fields=${fields}`);
}

// Done issues are never changed: a change to Done work always goes into a new issue.
const isDone = (issue) => issue.fields.status?.statusCategory?.key === "done";

async function refuseDone(key) {
  const issue = await getIssue(key, "status");
  if (isDone(issue)) die(`${key} is Done (${issue.fields.status.name}): Done issues are never changed. Put the change in a new issue.`);
}

// Marks every manifest issue (and the epic) that is Done in Jira with "done": true. Returns what it marked.
async function syncDone(manifest) {
  const marked = [];
  const all = [...(manifest.epic && manifest.epic.key ? [manifest.epic] : []), ...(manifest.issues || []).filter((i) => i.key)];
  for (const i of all) {
    if (i.done) continue;
    if (isDone(await getIssue(i.key, "status"))) {
      i.done = true;
      marked.push(`${i.id || "epic"}\t${i.key}`);
    }
  }
  return marked;
}

async function linkBlocks(blocker, blocked) {
  const has = (issue) =>
    (issue.fields.issuelinks || []).find(
      (l) => l.type.name.toLowerCase() === "blocks" && (l.inwardIssue?.key === blocker || l.outwardIssue?.key === blocker),
    );
  const existing = has(await getIssue(blocked, "issuelinks"));
  if (existing && existing.inwardIssue?.key === blocker) return "exists";
  if (existing) await api("DELETE", `/rest/api/3/issueLink/${existing.id}`);
  await api("POST", "/rest/api/3/issueLink", {
    type: { name: "Blocks" },
    outwardIssue: { key: blocker },
    inwardIssue: { key: blocked },
  });
  // Verify the direction: on the blocked issue the link must read "is blocked by <blocker>".
  const link = has(await getIssue(blocked, "issuelinks"));
  if (link && link.inwardIssue?.key === blocker) return "created";
  if (link) await api("DELETE", `/rest/api/3/issueLink/${link.id}`);
  await api("POST", "/rest/api/3/issueLink", {
    type: { name: "Blocks" },
    outwardIssue: { key: blocked },
    inwardIssue: { key: blocker },
  });
  const again = has(await getIssue(blocked, "issuelinks"));
  if (!again || again.inwardIssue?.key !== blocker) die(`could not create "${blocker} blocks ${blocked}" in the right direction`);
  return "created";
}

async function attachReplace(key, paths) {
  const issue = await getIssue(key, "attachment");
  const existing = issue.fields.attachment || [];
  for (const p of paths) {
    const name = basename(p);
    for (const a of existing.filter((x) => x.filename === name)) await api("DELETE", `/rest/api/3/attachment/${a.id}`);
    const form = new FormData();
    form.append("file", new Blob([readFileSync(p)]), name);
    await api("POST", `/rest/api/3/issue/${encodeURIComponent(key)}/attachments`, form);
  }
}

function issueMd(issue, pointsId) {
  const f = issue.fields;
  const out = [`# ${issue.key} · ${f.summary}`];
  const meta = [`**Type:** ${f.issuetype?.name}`, `**Status:** ${f.status?.name}`];
  if (pointsId && f[pointsId] != null) meta.push(`**Story points:** ${f[pointsId]}`);
  if (f.parent) meta.push(`**Parent:** ${f.parent.key}`);
  out.push(meta.join(" · "), `**URL:** ${browse(issue.key)}`);
  const links = f.issuelinks || [];
  const blockedBy = links.filter((l) => l.type.name.toLowerCase() === "blocks" && l.inwardIssue).map((l) => l.inwardIssue.key);
  const blocks = links.filter((l) => l.type.name.toLowerCase() === "blocks" && l.outwardIssue).map((l) => l.outwardIssue.key);
  if (blockedBy.length) out.push(`**Blocked by:** ${blockedBy.join(", ")}`);
  if (blocks.length) out.push(`**Blocks:** ${blocks.join(", ")}`);
  if (f.labels?.length) out.push(`**Labels:** ${f.labels.join(", ")}`);
  if (f.subtasks?.length)
    out.push("**Subtasks:**\n" + f.subtasks.map((s) => `- ${s.key} · ${s.fields.summary} (${s.fields.status?.name})`).join("\n"));
  if (f.attachment?.length) out.push("**Attachments:**\n" + f.attachment.map((a) => `- ${a.filename}`).join("\n"));
  out.push("## Description", adfToMd(f.description) || "_(empty)_");
  return out.join("\n\n");
}

// ---------------------------------------------------------------- commands

async function cmdCheck() {
  const cfg = config();
  const me = await api("GET", "/rest/api/3/myself");
  const types = await projectTypes();
  const linkTypes = await api("GET", "/rest/api/3/issueLinkType");
  const blocks = (linkTypes.issueLinkTypes || []).find((t) => t.name.toLowerCase() === "blocks");
  console.log(`Site:    ${cfg.base}`);
  console.log(`User:    ${me.displayName}`);
  console.log(`Project: ${cfg.project}`);
  console.log(`Types:   ${types.all.map((t) => t.name + (t.subtask ? " (subtask)" : "")).join(", ")}`);
  const problems = [];
  for (const k of ["epic", "story", "bug", "subtask"]) if (!types[k]) problems.push(`no ${k} issue type`);
  if (!blocks) problems.push('no "Blocks" link type');
  const points = await storyPointsField(types);
  console.log(`Points:  ${points ? `${points.name} (${points.id})` : "not found"}`);
  if (!points) problems.push("no story points field on the Story create screen (or set JIRA_STORY_POINTS_FIELD in .env)");
  const needed = ["BROWSE_PROJECTS", "CREATE_ISSUES", "EDIT_ISSUES", "LINK_ISSUES", "CREATE_ATTACHMENTS", "DELETE_OWN_ATTACHMENTS", "TRANSITION_ISSUES", "ADD_COMMENTS"];
  const perms = await api("GET", `/rest/api/3/mypermissions?projectKey=${encodeURIComponent(cfg.project)}&permissions=${needed.join(",")}`);
  const lacking = needed.filter((p) => !perms.permissions?.[p]?.havePermission);
  if (lacking.length) problems.push(`missing project permissions: ${lacking.join(", ")}`);
  if (existsSync(join(ROOT, ".env"))) {
    try {
      execFileSync("git", ["check-ignore", "-q", ".env"], { cwd: ROOT, stdio: "ignore" });
    } catch {
      problems.push(".env is not git-ignored: add it to .gitignore before committing");
    }
  }
  if (problems.length) {
    console.log("Problems:\n" + problems.map((p) => "- " + p).join("\n"));
    process.exit(1);
  }
  console.log("OK");
}

function cmdEnv() {
  const file = join(ROOT, ".env");
  const fromFile = readEnvFile();
  console.log(`.env:    ${existsSync(file) ? file : "missing (" + file + ")"}`);
  let ignored = false;
  try {
    execFileSync("git", ["check-ignore", "-q", ".env"], { cwd: ROOT, stdio: "ignore" });
    ignored = true;
  } catch {}
  let tracked = false;
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", ".env"], { cwd: ROOT, stdio: "ignore" });
    tracked = true;
  } catch {}
  console.log(`ignored: ${ignored ? "yes" : "no"}${tracked ? " (WARNING: .env is tracked by git)" : ""}`);
  for (const k of ["JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_PROJECT_KEY", "JIRA_API_TOKEN"]) {
    const v = fromFile[k] ?? process.env[k];
    const src = fromFile[k] !== undefined ? ".env" : process.env[k] !== undefined ? "shell" : "";
    const shown = !v ? "missing" : k === "JIRA_API_TOKEN" ? "set (hidden)" : v;
    console.log(`${k.padEnd(17)}${shown}${src ? `   [${src}]` : ""}`);
  }
}

async function cmdRead(argv) {
  const { pos, opts } = parseArgs(argv, ["parents"]);
  if (!pos[0]) die("usage: read <KEY> [--parents]");
  const pts = await storyPointsField();
  const fields = ISSUE_FIELDS + (pts ? `,${pts.id}` : "");
  let issue = await getIssue(pos[0], fields);
  const parts = [issueMd(issue, pts?.id)];
  while (opts.parents && issue.fields.parent) {
    issue = await getIssue(issue.fields.parent.key, fields);
    parts.push(issueMd(issue, pts?.id));
  }
  console.log(parts.join("\n\n---\n\n"));
}

async function cmdSearch(argv) {
  const { pos, opts } = parseArgs(argv);
  if (!pos[0]) die('usage: search "<JQL>" [--max N]');
  const max = Number(opts.max || 50);
  let token;
  let shown = 0;
  do {
    const res = await api("POST", "/rest/api/3/search/jql", {
      jql: pos[0],
      fields: ["summary", "status", "issuetype", "parent"],
      maxResults: Math.min(100, max - shown),
      ...(token ? { nextPageToken: token } : {}),
    });
    for (const i of res.issues || []) {
      const f = i.fields;
      console.log(`${i.key}\t${f.issuetype?.name}\t${f.status?.name}\t${f.summary}${f.parent ? `\t(parent ${f.parent.key})` : ""}`);
      shown++;
    }
    token = res.isLast ? undefined : res.nextPageToken;
  } while (token && shown < max);
  if (!shown) console.log("(no issues)");
}

async function cmdCreate(argv) {
  const { opts } = parseArgs(argv);
  if (!opts.type || !opts.summary) die("usage: create --type <epic|story|bug|subtask> --summary <text> [--description-file f.md] [--parent KEY] [--labels a,b] [--points N]");
  const types = await projectTypes();
  const fields = { project: { key: config().project }, issuetype: { id: typeId(types, opts.type) }, summary: opts.summary };
  try {
    if (opts["description-file"]) fields.description = adfField(readFileSync(resolve(opts["description-file"]), "utf8"), opts.summary);
  } catch (e) {
    die(e.message);
  }
  if (opts.parent) fields.parent = { key: opts.parent };
  if (opts.labels) fields.labels = opts.labels.split(",").map((s) => s.trim()).filter(Boolean);
  if (opts.points) {
    const pts = await storyPointsField(types);
    if (!pts) die("no story points field found. Run: jira.mjs check");
    try {
      fields[pts.id] = pointsValue(opts.points, opts.summary);
    } catch (e) {
      die(e.message);
    }
  }
  const res = await api("POST", "/rest/api/3/issue", { fields });
  console.log(`${res.key}\t${browse(res.key)}`);
}

async function cmdUpdate(argv) {
  const { pos, opts } = parseArgs(argv);
  if (!pos[0]) die("usage: update <KEY> [--summary <text>] [--description-file f.md] [--labels a,b] [--points N]");
  const fields = {};
  if (opts.summary) fields.summary = opts.summary;
  try {
    if (opts["description-file"]) fields.description = adfField(readFileSync(resolve(opts["description-file"]), "utf8"), pos[0]);
  } catch (e) {
    die(e.message);
  }
  if (opts.labels) fields.labels = opts.labels.split(",").map((s) => s.trim()).filter(Boolean);
  if (opts.points) {
    const pts = await storyPointsField();
    if (!pts) die("no story points field found. Run: jira.mjs check");
    try {
      fields[pts.id] = pointsValue(opts.points, pos[0]);
    } catch (e) {
      die(e.message);
    }
  }
  if (!Object.keys(fields).length) die("nothing to update");
  await refuseDone(pos[0]);
  await api("PUT", `/rest/api/3/issue/${encodeURIComponent(pos[0])}`, { fields });
  console.log(`${pos[0]}\tupdated`);
}

async function cmdLink(argv) {
  const { pos } = parseArgs(argv);
  if (pos.length !== 3 || pos[1] !== "blocks") die("usage: link <BLOCKER> blocks <BLOCKED>");
  console.log(`${pos[0]} blocks ${pos[2]}\t${await linkBlocks(pos[0], pos[2])}`);
}

async function cmdAttach(argv) {
  const { pos } = parseArgs(argv);
  if (pos.length < 2) die("usage: attach <KEY> <file>...");
  const files = pos.slice(1).map((p) => resolve(p));
  for (const f of files) if (!existsSync(f)) die(`file not found: ${f}`);
  await refuseDone(pos[0]);
  await attachReplace(pos[0], files);
  console.log(`${pos[0]}\tattached ${files.map((f) => basename(f)).join(", ")}`);
}

async function cmdTransition(argv) {
  const { pos } = parseArgs(argv);
  if (pos.length !== 2) die('usage: transition <KEY> "<status or transition name>"');
  const { transitions } = await api("GET", `/rest/api/3/issue/${encodeURIComponent(pos[0])}/transitions`);
  const want = pos[1].toLowerCase();
  const t = transitions.find((x) => x.to?.name.toLowerCase() === want) || transitions.find((x) => x.name.toLowerCase() === want);
  if (!t) die(`no transition to "${pos[1]}". Available: ${transitions.map((x) => `${x.name} -> ${x.to?.name}`).join(", ")}`);
  await api("POST", `/rest/api/3/issue/${encodeURIComponent(pos[0])}/transitions`, { transition: { id: t.id } });
  console.log(`${pos[0]}\t-> ${t.to?.name}`);
}

async function cmdComment(argv) {
  const { pos, opts } = parseArgs(argv);
  if (!pos[0] || (!opts.file && !opts.text)) die('usage: comment <KEY> (--file f.md | --text "...")');
  const md = opts.file ? readFileSync(resolve(opts.file), "utf8") : opts.text;
  let body;
  try {
    body = adfField(md, `comment on ${pos[0]}`);
  } catch (e) {
    die(e.message);
  }
  await api("POST", `/rest/api/3/issue/${encodeURIComponent(pos[0])}/comment`, { body });
  console.log(`${pos[0]}\tcommented`);
}

async function cmdConvert(argv) {
  const { pos, opts } = parseArgs(argv);
  if (!pos[0]) die("usage: convert <file.md> [--heading <text>]");
  let md = readFileSync(resolve(pos[0]), "utf8");
  if (opts.heading) md = extractSection(md, opts.heading, pos[0]);
  const adf = mdToAdf(md);
  console.log(JSON.stringify(adf, null, 2));
  console.error(`size: ${JSON.stringify(adf).length} / ${MAX_FIELD}`);
}

// ---------------------------------------------------------------- publish

function buildDescription(parts, label, errors) {
  const chunks = [];
  for (const p of parts || []) {
    try {
      if (p.text !== undefined) chunks.push(p.text);
      else if (p.file) chunks.push(readFileSync(join(ROOT, p.file), "utf8").trim());
      else if (p.from && p.heading) chunks.push(extractSection(readFileSync(join(ROOT, p.from), "utf8"), p.heading, p.from));
      else throw new Error(`bad description part ${JSON.stringify(p)}`);
    } catch (e) {
      errors.push(`${label}: ${e.code === "ENOENT" ? `file not found: ${e.path}` : e.message}`);
    }
  }
  const md = chunks.join("\n\n");
  try {
    return { md, adf: chunks.length ? adfField(md, label) : null };
  } catch (e) {
    errors.push(e.message);
    return { md, adf: null };
  }
}

function orderIssues(issues, errors) {
  const ids = new Set(issues.map((i) => i.id));
  const deps = new Map(
    issues.map((i) => [i.id, [...(i.parent && ids.has(i.parent) ? [i.parent] : []), ...(i.blockedBy || []).filter((b) => ids.has(b))]]),
  );
  const done = new Set();
  const order = [];
  while (order.length < issues.length) {
    const next = issues.find((i) => !done.has(i.id) && deps.get(i.id).every((d) => done.has(d)));
    if (!next) {
      errors.push(`dependency cycle among: ${issues.filter((i) => !done.has(i.id)).map((i) => i.id).join(", ")}`);
      return issues;
    }
    done.add(next.id);
    order.push(next);
  }
  return order;
}

async function cmdPublish(argv) {
  const { pos, opts } = parseArgs(argv, ["dry-run"]);
  if (!pos[0]) die("usage: publish <tickets.json> [--dry-run]");
  const manifestPath = resolve(pos[0]);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const save = () => writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  const issues = manifest.issues || [];
  const errors = [];

  // Done issues are frozen: mark them first (online), then skip them everywhere below.
  if (!opts["dry-run"]) {
    const marked = await syncDone(manifest);
    if (marked.length) save();
    for (const m of marked) console.log(`${m}\tDone: marked "done": true, never changed again`);
  }

  // Validate everything before touching Jira.
  const ids = new Set();
  for (const i of issues) {
    if (!i.id) errors.push(`issue without id: ${JSON.stringify(i).slice(0, 80)}`);
    else if (ids.has(i.id)) errors.push(`duplicate id ${i.id}`);
    ids.add(i.id);
  }
  const byId = new Map(issues.map((i) => [i.id, i]));
  const ref = (r) => byId.has(r) || KEY_RE.test(r);
  const epic = manifest.epic || null;
  if (epic && !epic.key && !epic.summary) errors.push("epic needs a key or a summary");
  if (epic && epic.done && !epic.key) errors.push('epic: "done" without a key');
  const epicDesc = epic && !epic.done && epic.description ? buildDescription(epic.description, "epic", errors) : null;
  const descs = new Map();
  for (const i of issues) {
    const type = (i.type || "").toLowerCase();
    if (!["story", "bug", "task", "subtask"].includes(type)) errors.push(`${i.id}: type must be story, bug, task or subtask`);
    if (i.done) {
      // Frozen: its summary, description, points and attachments are never checked or sent again.
      if (!i.key) errors.push(`${i.id}: "done" without a key`);
      continue;
    }
    if (!i.key && !i.summary) errors.push(`${i.id}: needs a summary`);
    if (type === "subtask") {
      if (!i.parent) errors.push(`${i.id}: subtask needs a parent`);
      else if (!ref(i.parent)) errors.push(`${i.id}: unknown parent ${i.parent}`);
      else if (byId.has(i.parent) && (byId.get(i.parent).type || "").toLowerCase() === "subtask") errors.push(`${i.id}: parent ${i.parent} is a subtask`);
      else if (!i.key && byId.has(i.parent) && byId.get(i.parent).done)
        errors.push(`${i.id}: parent ${i.parent} is Done: put the change in a new story instead`);
    }
    for (const b of i.blockedBy || []) if (!ref(b)) errors.push(`${i.id}: unknown blocker ${b}`);
    if (i.storyPoints !== undefined) {
      if (type !== "story") errors.push(`${i.id}: storyPoints are only for stories`);
      try {
        const n = pointsValue(i.storyPoints, i.id);
        if (manifest.maxStoryPoints !== undefined && n > manifest.maxStoryPoints)
          errors.push(`${i.id}: ${n} story points is over the maximum of ${manifest.maxStoryPoints}: split the story`);
      } catch (e) {
        errors.push(e.message);
      }
    }
    for (const a of i.attachments || []) if (!existsSync(join(ROOT, a))) errors.push(`${i.id}: attachment not found: ${a}`);
    if (i.description) descs.set(i.id, buildDescription(i.description, i.id, errors));
  }
  const order = orderIssues(issues, errors);
  if (errors.length) die("manifest is invalid, nothing was published:\n" + errors.map((e) => "- " + e).join("\n"));

  if (opts["dry-run"]) {
    const size = (d) => (d && d.adf ? `${JSON.stringify(d.adf).length}/${MAX_FIELD}` : "-");
    if (epic) console.log(`epic\t${epic.key || "new"}\t${epic.done ? "Done: skipped" : size(epicDesc)}\t${epic.summary || ""}`);
    for (const i of order) {
      if (i.done) {
        console.log(`${i.id}\t${i.type}\t${i.key}\tDone: skipped`);
        continue;
      }
      const extra = [
        i.storyPoints !== undefined ? `${i.storyPoints} pt` : "",
        i.parent ? `parent ${i.parent}` : "",
        (i.blockedBy || []).length ? `blocked by ${i.blockedBy.join(", ")}` : "",
        (i.attachments || []).length ? `${i.attachments.length} attachment(s)` : "",
      ].filter(Boolean);
      console.log(`${i.id}\t${i.type}\t${i.key || "new"}\t${size(descs.get(i.id))}\t${i.summary || ""}${extra.length ? "\t[" + extra.join("; ") + "]" : ""}`);
    }
    console.log('dry run OK: nothing was published (offline: run sync-done first so issues that are Done in Jira show as skipped)');
    return;
  }

  const types = await projectTypes();
  const keyOf = (r) => (byId.has(r) ? byId.get(r).key : r);
  const pts = issues.some((i) => i.storyPoints !== undefined) ? await storyPointsField(types) : null;
  if (issues.some((i) => i.storyPoints !== undefined) && !pts) die("no story points field found, nothing was published. Run: jira.mjs check");

  if (epic && epic.done) console.log(`epic\t${epic.key}\tDone: skipped`);
  else if (epic) {
    const fields = {};
    if (epic.summary) fields.summary = epic.summary;
    if (epicDesc && epicDesc.adf) fields.description = epicDesc.adf;
    if (!epic.key) {
      const res = await api("POST", "/rest/api/3/issue", {
        fields: { project: { key: config().project }, issuetype: { id: typeId(types, "epic") }, ...fields },
      });
      epic.key = res.key;
      save();
      console.log(`epic\t${epic.key}\tcreated`);
    } else if (Object.keys(fields).length) {
      await api("PUT", `/rest/api/3/issue/${epic.key}`, { fields });
      console.log(`epic\t${epic.key}\tupdated`);
    }
  }

  for (const i of order) {
    if (i.done) {
      console.log(`${i.id}\t${i.key}\tDone: skipped`);
      continue;
    }
    const type = i.type.toLowerCase();
    const fields = {};
    if (i.summary) fields.summary = i.summary;
    const d = descs.get(i.id);
    if (d && d.adf) fields.description = d.adf;
    if (i.labels) fields.labels = i.labels;
    if (i.storyPoints !== undefined) fields[pts.id] = Number(i.storyPoints);
    if (!i.key) {
      fields.project = { key: config().project };
      fields.issuetype = { id: typeId(types, type) };
      if (type === "subtask") fields.parent = { key: keyOf(i.parent) };
      else if (epic) fields.parent = { key: epic.key };
      const res = await api("POST", "/rest/api/3/issue", { fields });
      i.key = res.key;
      save();
      console.log(`${i.id}\t${i.key}\tcreated`);
    } else {
      await api("PUT", `/rest/api/3/issue/${i.key}`, { fields });
      console.log(`${i.id}\t${i.key}\tupdated`);
    }
    if ((i.attachments || []).length) {
      await attachReplace(i.key, i.attachments.map((a) => join(ROOT, a)));
      console.log(`${i.id}\t${i.key}\tattached ${i.attachments.length} file(s)`);
    }
  }

  for (const i of order) for (const b of i.done ? [] : i.blockedBy || []) console.log(`${keyOf(b)} blocks ${i.key}\t${await linkBlocks(keyOf(b), i.key)}`);

  console.log("\nPublished:");
  if (epic) console.log(`epic\t${epic.key}\t${browse(epic.key)}`);
  for (const i of order) console.log(`${i.id}\t${i.key}\t${browse(i.key)}`);
}

async function cmdSyncDone(argv) {
  const { pos } = parseArgs(argv);
  if (!pos[0]) die("usage: sync-done <tickets.json>");
  const manifestPath = resolve(pos[0]);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const marked = await syncDone(manifest);
  if (marked.length) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  for (const m of marked) console.log(`${m}\tDone: marked "done": true`);
  const frozen = [...(manifest.epic?.done ? [`epic\t${manifest.epic.key}`] : []), ...(manifest.issues || []).filter((i) => i.done).map((i) => `${i.id}\t${i.key}`)];
  console.log(frozen.length ? `Done (frozen):\n${frozen.join("\n")}` : "no Done issues");
}

// ---------------------------------------------------------------- main

const COMMANDS = {
  env: cmdEnv,
  check: cmdCheck,
  read: cmdRead,
  search: cmdSearch,
  create: cmdCreate,
  update: cmdUpdate,
  link: cmdLink,
  attach: cmdAttach,
  transition: cmdTransition,
  comment: cmdComment,
  convert: cmdConvert,
  publish: cmdPublish,
  "sync-done": cmdSyncDone,
};

const [cmd, ...rest] = process.argv.slice(2);
if (!COMMANDS[cmd]) {
  console.error(`usage: jira.mjs <${Object.keys(COMMANDS).join("|")}> ...   (see SKILL.md)`);
  process.exit(1);
}
Promise.resolve()
  .then(() => COMMANDS[cmd](rest))
  .catch((e) => die(e.stack || String(e)));
