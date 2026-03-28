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

function hasOrderedSections(text, sections) {
  let last = -1;
  for (const section of sections) {
    const idx = text.indexOf(section);
    if (idx === -1 || idx <= last) {
      return false;
    }
    last = idx;
  }
  return true;
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    process.stdout.write(preToolAllow("No payload; skipping diagnostics format gate."));
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.stdout.write(preToolAllow("Invalid payload JSON; skipping diagnostics format gate."));
    return;
  }

  const toolName = getToolName(payload);
  if (toolName !== "task_complete") {
    process.stdout.write(preToolAllow("Not a completion step; skipping diagnostics format gate."));
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
    "actionability",
  ];

  const diagnosticsLike =
    containsAny(summaryText, diagnosticsSignals) || containsAny(allText, diagnosticsSignals);

  if (!diagnosticsLike) {
    process.stdout.write(preToolAllow("Completion is not diagnostics-review-like; allowing."));
    return;
  }

  const requiredSections = [
    "findings",
    "open questions/assumptions",
    "secondary summary",
    "validation status",
    "recommended fix direction",
    "confidence",
  ];

  if (hasOrderedSections(allText, requiredSections)) {
    process.stdout.write(
      preToolAllow("Diagnostics review completion matches exact deterministic section order; allowing.")
    );
    return;
  }

  process.stdout.write(
    preToolDeny(
      "Blocked: diagnostics review completion must use exact section heading order: Findings, Open Questions/Assumptions, Secondary Summary, Validation Status, Recommended Fix Direction, Confidence."
    )
  );
  process.exitCode = 2;
}

main();