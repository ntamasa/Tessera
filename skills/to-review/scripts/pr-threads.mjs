#!/usr/bin/env node
// PR conversation helper for the factory: review threads (findings, replies, resolve) and top-level notes.
// Node 18+, no dependencies; uses the gh CLI's login. Run it from inside the project's git checkout.
//
//   list    <pr>                                   every thread, and the human's top-level comments, as JSON
//   human   <pr>                                   only what the human wrote that the factory hasn't handled yet:
//                                                  open threads whose last comment is theirs, unanswered notes
//   finding <pr> <reviewer> <head> <path> <line|0> body on stdin: a new review thread (line, else file level)
//   reply   <pr> <t:|c:|r:id> [flags]              body on stdin (may be empty with --resolve): see below
//   verdict <pr> <reviewer>                        body on stdin: the reviewer's verdict comment; hides its older ones
//   note    <pr> <kind>                            body on stdin: a factory comment; hides older notes of that kind
//
// reply flags: --decision dismissed|kept|repeat|fixed|none   --final   --dispute <reviewer>   --resolve | --unresolve
//   t:<id> (a thread comment) replies in its thread; c:<id> / r:<id> (a top-level comment or review body,
//   which can't be resolved) gets a new top-level comment that links to it.
//
// Every comment this script posts ends with a <!-- factory-… --> marker. Comments without one are the human's.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function die(msg) {
  console.error(`pr-threads: ${msg}`);
  process.exit(1);
}

function gh(args, input) {
  try {
    return execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 64 << 20 });
  } catch (e) {
    const err = new Error(String(e.stderr || e.message || "").trim());
    err.isGh = true;
    throw err;
  }
}
const ghJson = (args, input) => JSON.parse(gh(args, input) || "null");
const readStdin = () => {
  if (process.stdin.isTTY) return "";
  try {
    return readFileSync(0, "utf8").trim();
  } catch {
    return "";
  }
};

function gql(query, vars) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(vars)) args.push(typeof v === "number" ? "-F" : "-f", `${k}=${v}`);
  const r = ghJson(args);
  if (r?.errors?.length) die(r.errors.map((e) => e.message).join("; "));
  return r.data;
}

const MARKER = /<!--\s*(factory[^>]*?)\s*-->/;
const markerOf = (body) => (body || "").match(MARKER)?.[1] ?? null;
// The merge gate's comments and older factory comments have no marker: known by their heading.
const FACTORY_HEADING = /^## (✅|❌|⛔|Human review needed|Dismissed by review-triage|Review decisions)/;
const isFactory = (body) => /<!--\s*factory/.test(body || "") || FACTORY_HEADING.test((body || "").trimStart());
const strip = (body) => (body || "").replace(/\s*<!--\s*factory[^>]*?-->\s*/g, "").trim();

let repoCache;
function repo() {
  if (!repoCache) {
    const r = ghJson(["repo", "view", "--json", "owner,name"]);
    repoCache = { o: r.owner.login, r: r.name };
  }
  return repoCache;
}

const PR_QUERY = `query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){pullRequest(number:$n){
  reviewThreads(first:100){nodes{id isResolved isOutdated path line originalLine
    comments(first:100){nodes{databaseId url body createdAt}}}}
  reviews(first:100){nodes{databaseId url body state submittedAt}}
  comments(first:100){nodes{databaseId id url body isMinimized createdAt}}
}}}`;

function load(pr) {
  const { o, r } = repo();
  const p = gql(PR_QUERY, { o, r, n: Number(pr) }).repository.pullRequest;
  if (!p) die(`no PR #${pr}`);
  const replies = new Set();
  for (const c of p.comments.nodes) {
    const m = markerOf(c.body)?.match(/factory-reply to=([trc]:\d+)/);
    if (m) replies.add(m[1]);
  }
  const threads = p.reviewThreads.nodes.map((t) => {
    const comments = t.comments.nodes.map((c) => ({
      id: `t:${c.databaseId}`,
      url: c.url,
      by: isFactory(c.body) ? "factory" : "human",
      marker: markerOf(c.body),
      body: strip(c.body),
    }));
    return {
      thread: t.id,
      resolved: t.isResolved,
      outdated: t.isOutdated,
      path: t.path,
      line: t.line ?? t.originalLine ?? null,
      comments,
    };
  });
  const notes = [
    ...p.reviews.nodes
      .filter((v) => strip(v.body) && !isFactory(v.body))
      .map((v) => ({ id: `r:${v.databaseId}`, url: v.url, kind: `review ${v.state.toLowerCase()}`, body: strip(v.body) })),
    ...p.comments.nodes
      .filter((c) => !isFactory(c.body))
      .map((c) => ({ id: `c:${c.databaseId}`, url: c.url, kind: "comment", body: strip(c.body) })),
  ].map((n) => ({ ...n, answered: replies.has(n.id) }));
  return { threads, notes, rawComments: p.comments.nodes };
}

function cmdList(pr) {
  const { threads, notes } = load(pr);
  console.log(JSON.stringify({ threads, notes }, null, 1));
}

function cmdHuman(pr) {
  const { threads, notes } = load(pr);
  // Open threads whose last word is the human's: a new comment, or a reply to the factory (reopen a thread to
  // dispute it). A thread the human resolved is settled.
  const open = threads.filter((t) => !t.resolved && t.comments.at(-1)?.by === "human");
  const unanswered = notes.filter((n) => !n.answered);
  console.log(JSON.stringify({ count: open.length + unanswered.length, threads: open, notes: unanswered }, null, 1));
}

function post(path, payload) {
  return ghJson(["api", "-X", "POST", path, "--input", "-"], JSON.stringify(payload));
}

function cmdFinding(pr, reviewer, head, path, line) {
  const text = readStdin();
  if (!text) die("finding: empty body");
  if (!/^[0-9a-f]{40}$/.test(head || "")) die("finding: <head> must be the full 40-character sha");
  const { o, r } = repo();
  const url = `repos/${o}/${r}/pulls/${pr}/comments`;
  const body = (where) => `${where ? `**where:** \`${where}\`\n\n` : ""}${text}\n\n<!-- factory-finding reviewer=${reviewer} head=${head} -->`;
  const n = Number(line);
  const tries = [];
  if (n > 0) tries.push({ commit_id: head, path, line: n, side: "RIGHT", body: body("") });
  tries.push({ commit_id: head, path, subject_type: "file", body: body(n > 0 ? `${path}:${n}` : "") });
  let res;
  for (const t of tries) {
    try {
      res = post(url, t);
      break;
    } catch (e) {
      if (!e.isGh) throw e;
    }
  }
  if (!res) {
    // Not a file of this PR: anchor it on the PR's first changed file, and say where it really is.
    const files = ghJson(["api", `repos/${o}/${r}/pulls/${pr}/files?per_page=100`]);
    if (!files?.length) die("finding: the PR has no files to anchor a thread on");
    res = post(url, { commit_id: head, path: files[0].filename, subject_type: "file", body: body(n > 0 ? `${path}:${n}` : path) });
  }
  console.log(JSON.stringify({ id: `t:${res.id}`, url: res.html_url }));
}

function threadOf(threads, id) {
  const t = threads.find((x) => x.comments.some((c) => c.id === id));
  if (!t) die(`no review thread holds ${id}`);
  return t;
}

function setResolved(threadId, resolved) {
  const name = resolved ? "resolveReviewThread" : "unresolveReviewThread";
  gql(`mutation($id:ID!){${name}(input:{threadId:$id}){thread{isResolved}}}`, { id: threadId });
}

function cmdReply(pr, id, flags) {
  if (!/^[trc]:\d+$/.test(id || "")) die("reply: id must be t:<n>, c:<n> or r:<n> (from list or human)");
  const text = readStdin();
  const parts = [`factory-reply to=${id}`];
  if (flags.decision) parts.push(`decision=${flags.decision}`);
  if (flags.final) parts.push("final");
  if (flags.dispute) parts.push(`dispute reviewer=${flags.dispute}`);
  const marker = `<!-- ${parts.join(" ")} -->`;
  const { o, r } = repo();
  let out = {};
  if (id.startsWith("t:")) {
    const { threads } = load(pr);
    const t = threadOf(threads, id);
    if (text) {
      const res = post(`repos/${o}/${r}/pulls/${pr}/comments/${t.comments[0].id.slice(2)}/replies`, { body: `${text}\n\n${marker}` });
      out = { id: `t:${res.id}`, url: res.html_url };
    }
    if (flags.resolve && !t.resolved) setResolved(t.thread, true);
    if (flags.unresolve && t.resolved) setResolved(t.thread, false);
    out.resolved = flags.resolve ? true : flags.unresolve ? false : t.resolved;
  } else {
    if (!text) die("reply: a top-level comment or review can't be resolved: give a body");
    const { notes } = load(pr);
    const n = notes.find((x) => x.id === id);
    if (!n) die(`reply: no human comment ${id} on #${pr}`);
    const quote = n.body.split(/\r?\n/).find((l) => l.trim()) || "";
    const res = post(`repos/${o}/${r}/issues/${pr}/comments`, {
      body: `> ${quote.slice(0, 200)}${quote.length > 200 ? "…" : ""}\n> ([your comment](${n.url}))\n\n${text}\n\n${marker}`,
    });
    out = { id: `c:${res.id}`, url: res.html_url };
  }
  console.log(JSON.stringify(out));
}

function hideOlder(pr, test) {
  const { rawComments } = load(pr);
  const older = rawComments.filter((c) => !c.isMinimized && test(markerOf(c.body) || ""));
  for (const c of older.slice(0, -1)) {
    gql(`mutation($id:ID!){minimizeComment(input:{subjectId:$id,classifier:OUTDATED}){minimizedComment{isMinimized}}}`, { id: c.id });
  }
  return Math.max(older.length - 1, 0);
}

function cmdVerdict(pr, reviewer) {
  const text = readStdin();
  const m = markerOf(text)?.match(/factory-review reviewer=([\w-]+)/);
  if (!m || m[1] !== reviewer) die(`verdict: the body must end with <!-- factory-review reviewer=${reviewer} verdict=… head=… -->`);
  const { o, r } = repo();
  const res = post(`repos/${o}/${r}/issues/${pr}/comments`, { body: text });
  const hidden = hideOlder(pr, (mk) => new RegExp(`^factory-review reviewer=${reviewer}\\b`).test(mk));
  console.log(JSON.stringify({ id: `c:${res.id}`, url: res.html_url, hidden }));
}

function cmdNote(pr, kind) {
  if (!/^[\w-]+$/.test(kind || "")) die("note: <kind> is one word, like human-review");
  const text = readStdin();
  if (!text) die("note: empty body");
  const { o, r } = repo();
  const res = post(`repos/${o}/${r}/issues/${pr}/comments`, { body: `${text}\n\n<!-- factory-note kind=${kind} -->` });
  const hidden = hideOlder(pr, (mk) => mk === `factory-note kind=${kind}`);
  console.log(JSON.stringify({ id: `c:${res.id}`, url: res.html_url, hidden }));
}

function parseFlags(rest) {
  const f = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--final") f.final = true;
    else if (a === "--resolve") f.resolve = true;
    else if (a === "--unresolve") f.unresolve = true;
    else if (a === "--decision") f.decision = rest[++i];
    else if (a === "--dispute") f.dispute = rest[++i];
    else die(`unknown flag ${a}`);
  }
  if (f.decision && !["dismissed", "kept", "repeat", "fixed", "none"].includes(f.decision)) die(`bad --decision ${f.decision}`);
  if (f.resolve && f.unresolve) die("--resolve and --unresolve together");
  return f;
}

const [cmd, pr, ...rest] = process.argv.slice(2);
if (!cmd || !/^\d+$/.test(pr || "")) die("usage: list|human|finding|reply|verdict|note <pr> …  (see the header of this file)");
try {
  if (cmd === "list") cmdList(pr);
  else if (cmd === "human") cmdHuman(pr);
  else if (cmd === "finding") cmdFinding(pr, ...rest.slice(0, 4));
  else if (cmd === "reply") cmdReply(pr, rest[0], parseFlags(rest.slice(1)));
  else if (cmd === "verdict") cmdVerdict(pr, rest[0]);
  else if (cmd === "note") cmdNote(pr, rest[0]);
  else die(`unknown command ${cmd}`);
} catch (e) {
  die(e.message);
}
