// Turns the Turborepo run summary (.turbo/runs/*.json, written by --summarize) into the
// Markdown shown on the CI run's summary page: every task with its result, time and whether
// it came from the cache, then the end of the log of each failed task.
// Usage: node .github/scripts/ci-report.mjs >> "$GITHUB_STEP_SUMMARY"
import fs from "node:fs";
import path from "node:path";

const RUNS_DIR = ".turbo/runs";
const LOG_LINES = 60;

function latestSummary() {
  if (!fs.existsSync(RUNS_DIR)) return null;
  const files = fs
    .readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(RUNS_DIR, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return files.length ? JSON.parse(fs.readFileSync(files[0], "utf8")) : null;
}

function seconds(execution) {
  if (!execution?.startTime || !execution?.endTime) return "";
  return `${((execution.endTime - execution.startTime) / 1000).toFixed(1)} s`;
}

function tail(file, lines) {
  try {
    const text = fs.readFileSync(file, "utf8").replace(/\x1b\[[0-9;]*m/g, ""); // strip colours
    return text.trimEnd().split("\n").slice(-lines).join("\n");
  } catch {
    return "(log not found)";
  }
}

const summary = latestSummary();
if (!summary) {
  console.log("### ❌ No Turborepo run summary\nThe build step stopped before any task ran; see the step log above.");
  process.exit(0);
}

const tasks = [...(summary.tasks ?? [])].sort((a, b) => a.taskId.localeCompare(b.taskId));
const failed = tasks.filter((t) => t.execution && t.execution.exitCode !== 0);
const cached = tasks.filter((t) => t.cache?.status === "HIT");
const notRun = tasks.filter((t) => !t.execution && t.cache?.status !== "HIT");

const lines = [];
lines.push(failed.length ? `## ❌ ${failed.length} task(s) failed` : "## ✅ All checks passed");
lines.push(
  `${tasks.length} task(s): ${tasks.length - failed.length - notRun.length} passed` +
    ` (${cached.length} reused from cache)` +
    (failed.length ? `, **${failed.length} failed**` : "") +
    (notRun.length ? `, ${notRun.length} not run because something they need failed` : "") +
    ".",
);
lines.push("");
lines.push("| Package | Task | Result | Time |");
lines.push("|---|---|---|---|");
for (const t of tasks) {
  const [pkg] = t.taskId.split("#");
  let result;
  if (t.execution && t.execution.exitCode !== 0) result = `❌ failed (exit ${t.execution.exitCode})`;
  else if (t.cache?.status === "HIT") result = "⚡ cached";
  else if (t.execution) result = "✅ passed";
  else result = "⏭️ not run";
  lines.push(`| \`${pkg}\` | ${t.task} | ${result} | ${t.cache?.status === "HIT" ? "" : seconds(t.execution)} |`);
}

for (const t of failed) {
  const log = t.logFile ? path.join(summary.repoPath ?? "", t.logFile) : path.join(t.directory ?? "", ".turbo", `turbo-${t.task}.log`);
  lines.push("");
  lines.push(`<details open><summary><b>❌ ${t.taskId}</b>: last ${LOG_LINES} lines of the log</summary>`);
  lines.push("");
  lines.push("```text");
  lines.push(tail(fs.existsSync(log) ? log : t.logFile ?? log, LOG_LINES));
  lines.push("```");
  lines.push("</details>");
}

if (failed.length) {
  lines.push("");
  lines.push("Full logs: the **failed-task-logs** artifact of this run. Run the same check locally with `pnpm turbo run <task> --filter=<package>`.");
}

console.log(lines.join("\n"));
