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

function preToolAllow(reason) {
  return JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: reason,
    },
  });
}

function preToolDeny(reason) {
  return JSON.stringify({
    continue: false,
    stopReason: reason,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
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

function getCompletionSummary(payload) {
  const direct = payload?.summary;
  if (typeof direct === "string") return direct;

  const nested = payload?.input?.summary;
  if (typeof nested === "string") return nested;

  return "";
}

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

function normalize(text) {
  return (text || "").toLowerCase();
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    process.stdout.write(
      preToolAllow("No payload; skipping diagnostics validation gate."),
    );
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(
      preToolAllow(
        "Invalid payload JSON; skipping diagnostics validation gate.",
      ),
    );
    return;
  }

  const toolName = getToolName(payload);
  if (toolName !== "task_complete") {
    process.stdout.write(
      preToolAllow(
        "Not a completion step; skipping diagnostics validation gate.",
      ),
    );
    return;
  }

  const summaryText = normalize(getCompletionSummary(payload));
  const allText = normalize(collectStrings(payload).join("\n"));

  const diagnosticsSignals = [
    "diagnostic",
    "diagnostics",
    "error message",
    "wording",
    "clarity",
    "consistency",
  ];

  const diagnosticsLike =
    containsAny(summaryText, diagnosticsSignals) ||
    containsAny(allText, diagnosticsSignals);

  if (!diagnosticsLike) {
    process.stdout.write(
      preToolAllow("Completion is not diagnostics-review-like; allowing."),
    );
    return;
  }

  const validationSignals = [
    "validation status",
    "validation verdict",
    "command validation",
  ];

  const buildSignals = [
    "npm run build",
    "could not run build",
    "build not run",
  ];

  const startSignals = [
    "npm run start",
    "could not run start",
    "start not run",
  ];

  const hasValidationSection = containsAny(allText, validationSignals);
  const hasBuildEvidence = containsAny(allText, buildSignals);
  const hasStartEvidence = containsAny(allText, startSignals);

  if (hasValidationSection && hasBuildEvidence && hasStartEvidence) {
    process.stdout.write(
      preToolAllow(
        "Diagnostics completion includes strict validation evidence; allowing.",
      ),
    );
    return;
  }

  process.stdout.write(
    preToolDeny(
      "Blocked: diagnostics-review completion must include strict validation evidence: Validation Status/Command Validation plus both build and start coverage (executed or explicitly not run).",
    ),
  );
  process.exitCode = 2;
}

main();
