import { execSync } from "node:child_process";

const EDIT_TOOLS = new Set([
  "apply_patch",
  "create_file",
  "edit_notebook_file",
  "vscode_renameSymbol",
  "vscode_renameFile",
]);

const PIPELINE_PATHS = new Set([
  "src/typechecker.ts",
  "src/unification.ts",
  "src/elaboration.ts",
  "src/ir.ts",
  "src/eval.ts",
  "src/main.ts",
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

function hasPipelineTarget(payload) {
  const strings = collectStrings(payload);
  return strings.some((s) => PIPELINE_PATHS.has(normalizePathLike(s)));
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

function run(command) {
  return execSync(command, { encoding: "utf8" });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    process.stdout.write(continueResponse("No hook payload; skipping pipeline verification."));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(continueResponse("Invalid hook payload JSON; skipping pipeline verification."));
    return;
  }

  const toolName = getToolName(payload);
  if (!EDIT_TOOLS.has(toolName)) {
    process.stdout.write(continueResponse("Tool is not an edit action; skipping pipeline verification."));
    return;
  }

  if (!hasPipelineTarget(payload)) {
    process.stdout.write(continueResponse("No GADT pipeline target file changed; skipping pipeline verification."));
    return;
  }

  try {
    const buildOut = run("npm run build");
    if (buildOut?.trim()) {
      process.stderr.write(`${buildOut.trim()}\n`);
    }

    const startOut = run("npm run start");
    if (startOut?.trim()) {
      process.stderr.write(`${startOut.trim()}\n`);
    }

    process.stdout.write(continueResponse("GADT pipeline verification succeeded (build + start)."));
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? "";
    const stderr = error?.stderr?.toString?.() ?? "";
    const details = summarize(`${stdout}\n${stderr}`);
    if (details) {
      process.stderr.write(`${details}\n`);
    }

    process.stdout.write(blockResponse("GADT pipeline verification failed (build/start)."));
    process.exitCode = 2;
  }
}

main();
