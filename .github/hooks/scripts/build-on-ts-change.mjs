import { execSync } from "node:child_process";

const EDIT_TOOLS = new Set([
  "apply_patch",
  "create_file",
  "edit_notebook_file",
  "vscode_renameSymbol",
  "vscode_renameFile",
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

function hasTsSourcePath(payload) {
  const strings = collectStrings(payload);
  return strings.some((s) => {
    const normalized = s.replaceAll("\\", "/");
    return /(^|\/)src\/.*\.ts$/.test(normalized);
  });
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
  if (normalized.length <= 300) return normalized;
  return `${normalized.slice(0, 300)}...`;
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    process.stdout.write(continueResponse("No hook payload; skipping auto-build."));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(continueResponse("Invalid hook payload JSON; skipping auto-build."));
    return;
  }

  const toolName = getToolName(payload);
  if (!EDIT_TOOLS.has(toolName)) {
    process.stdout.write(continueResponse("Tool is not an edit action; skipping auto-build."));
    return;
  }

  if (!hasTsSourcePath(payload)) {
    process.stdout.write(continueResponse("No src/**/*.ts target detected; skipping auto-build."));
    return;
  }

  try {
    const output = execSync("npm run build", { encoding: "utf8" });
    if (output?.trim()) {
      process.stderr.write(`${output.trim()}\n`);
    }
    process.stdout.write(continueResponse("Auto-build succeeded after TypeScript source edit."));
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    const stderr = error?.stderr?.toString?.() ?? "";
    const details = summarize(`${stdout}\n${stderr}`);
    if (details) {
      process.stderr.write(`${details}\n`);
    }
    process.stdout.write(blockResponse("Auto-build failed after TypeScript source edit."));
    process.exitCode = 2;
  }
}

main();
