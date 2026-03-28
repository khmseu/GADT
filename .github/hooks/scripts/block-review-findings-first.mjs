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

function containsAny(text, words) {
  return words.some((word) => text.includes(word));
}

function getCompletionSummary(payload) {
  const direct = payload?.summary;
  if (typeof direct === "string") return direct;

  const nested = payload?.input?.summary;
  if (typeof nested === "string") return nested;

  return "";
}

function hasFindingsFirstShape(summaryLower) {
  const findingsIdx = summaryLower.indexOf("findings");
  const summaryIdx = summaryLower.indexOf("summary");

  if (findingsIdx === -1) return false;
  if (summaryIdx === -1) return true;

  return findingsIdx < summaryIdx;
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    process.stdout.write(preToolAllow("No payload; skipping findings-first gate."));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(preToolAllow("Invalid payload JSON; skipping findings-first gate."));
    return;
  }

  const toolName = getToolName(payload);
  if (toolName !== "task_complete") {
    process.stdout.write(preToolAllow("Not a completion step; skipping findings-first gate."));
    return;
  }

  const summary = getCompletionSummary(payload);
  const summaryLower = summary.toLowerCase();
  const allText = collectStrings(payload).join("\n").toLowerCase();

  const reviewSignals = [
    "review",
    "audit",
    "finding",
    "findings",
    "severity",
    "soundness",
    "regression",
    "diagnostic",
  ];

  const reviewLike = containsAny(summaryLower || allText, reviewSignals);
  if (!reviewLike) {
    process.stdout.write(preToolAllow("Completion is not review-like; allowing."));
    return;
  }

  if (!hasFindingsFirstShape(summaryLower)) {
    process.stdout.write(
      preToolDeny(
        "Blocked: review completion must be findings-first. Include a Findings section before any summary."
      )
    );
    process.exitCode = 2;
    return;
  }

  process.stdout.write(preToolAllow("Review completion is findings-first; allowing."));
}

main();
