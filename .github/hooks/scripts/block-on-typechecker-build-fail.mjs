import { execSync } from "node:child_process";

const EDIT_TOOLS = new Set([
  "apply_patch",
  "create_file",
  "edit_notebook_file",
  "vscode_renameSymbol",
  "vscode_renameFile",
]);

const GUARDED_FILES = new Set([
  "src/typechecker.ts",
  "src/unification.ts",
]);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function collectStrings(value, out = []) {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
  return out;
}

function getToolName(payload) {
  return (
    payload?.toolName ||
    payload?.tool_name ||
    payload?.tool?.name ||
    payload?.name ||
    ""
  );
}

function normalizePathLike(text) {
  return text.replaceAll("\\", "/").replace(/^\.\//, "");
}

function touchesGuardedFile(payload) {
  const strings = collectStrings(payload);
  return strings.some((s) => GUARDED_FILES.has(normalizePathLike(s)));
}

function continueResponse(systemMessage) {
  return JSON.stringify({ continue: true, systemMessage });
}

function blockResponse(stopReason) {
  return JSON.stringify({ decision: "block", stopReason });
}

function summarize(text) {
  if (!text) return "";
  const normalized = text.toString().trim();
  if (normalized.length <= 500) return normalized;
  return `${normalized.slice(0, 500)}...`;
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    process.stdout.write(continueResponse("No hook payload; skipping guarded build check."));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(continueResponse("Invalid hook payload JSON; skipping guarded build check."));
    return;
  }

  const toolName = getToolName(payload);
  if (!EDIT_TOOLS.has(toolName)) {
    process.stdout.write(continueResponse("Tool is not an edit action; skipping guarded build check."));
    return;
  }

  if (!touchesGuardedFile(payload)) {
    process.stdout.write(continueResponse("No guarded file changed; skipping guarded build check."));
    return;
  }

  try {
    const output = execSync("npm run build", { encoding: "utf8" });
    if (output?.trim()) {
      process.stderr.write(`${output.trim()}\n`);
    }
    process.stdout.write(continueResponse("Guarded build check passed after typechecker/unification edit."));
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    const stderr = error?.stderr?.toString?.() ?? "";
    const details = summarize(`${stdout}\n${stderr}`);
    if (details) {
      process.stderr.write(`${details}\n`);
    }
    process.stdout.write(blockResponse("Build failed after edit to guarded typechecker/unification file."));
    process.exitCode = 2;
  }
}

main();
