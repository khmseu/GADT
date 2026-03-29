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
      preToolAllow("No payload; skipping regression validation gate."),
    );
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(
      preToolAllow(
        "Invalid payload JSON; skipping regression validation gate.",
      ),
    );
    return;
  }

  const toolName = getToolName(payload);
  if (toolName !== "task_complete") {
    process.stdout.write(
      preToolAllow(
        "Not a completion step; skipping regression validation gate.",
      ),
    );
    return;
  }

  const summaryText = normalize(getCompletionSummary(payload));
  const allText = normalize(collectStrings(payload).join("\n"));

  const regressionSignals = [
    "regression",
    "regressions",
    "behavior drift",
    "cross-stage",
    "pipeline",
    "elaboration",
    "eval",
    "reproduction notes",
  ];

  const regressionLike =
    containsAny(summaryText, regressionSignals) ||
    containsAny(allText, regressionSignals);
  if (!regressionLike) {
    process.stdout.write(
      preToolAllow("Completion is not regression-audit-like; allowing."),
    );
    return;
  }

  const validationSignals = [
    "validation status",
    "validation verdict",
    "command validation",
    "validation",
    "validated",
    "npm run build",
    "npm run start",
    "could not run",
    "not run",
  ];

  const hasValidationEvidence = containsAny(allText, validationSignals);
  if (hasValidationEvidence) {
    process.stdout.write(
      preToolAllow(
        "Regression-audit completion includes validation evidence; allowing.",
      ),
    );
    return;
  }

  process.stdout.write(
    preToolDeny(
      "Blocked: regression-audit completion must include explicit validation-status evidence (for example Validation Status with npm run build/start outcomes, or explicit could-not-run notes).",
    ),
  );
  process.exitCode = 2;
}

main();
