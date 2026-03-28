---
description: "Use when running strict diagnostics-quality audits that must always include build and start validation evidence. Trigger phrases: strict diagnostics review, diagnostics quality strict, always-on diagnostics validation, deterministic diagnostics audit."
name: "Review Diagnostics Quality (Strict)"
argument-hint: "Describe changed files/diff, failing scenarios, and diagnostics you want evaluated under strict validation rules."
agent: "GADT Diagnostics Reviewer"
---
Review diagnostics quality for the provided changes in this repository.

This prompt is for analysis/audit output only. Do not implement code changes unless explicitly requested.

Use the argument text as input for:
- changed files or diff context
- failing scenarios or user-facing error output
- diagnostics the user is unsure about

Apply project-specific guidance from:
- [Workspace Guidelines](../copilot-instructions.md)
- [Typechecker Refinement Rules](../instructions/typechecker-refinement.instructions.md)
- [GADT Diagnostics Reviewer](../agents/gadt-diagnostics-review.agent.md)

Review focus:
1. Error-message specificity (constructor/type names included).
2. Consistency of wording across related failure paths.
3. Actionability: whether users can infer likely fixes from the message.
4. Placement and context: whether diagnostics appear at the right stage.
5. Regressions where stricter checks degraded message clarity.
6. Confidence level and blind spots from missing context.

Strict validation requirements:
- Always run `npm run build`.
- Always run `npm run start`.
- If either command cannot be run, state that explicitly and treat it as residual risk.

Required output format:
1. Findings (ordered by severity): include risk, impact, and file references.
2. Open questions or assumptions (only if needed).
3. Secondary summary: brief recap after findings.
4. Validation status: include both `npm run build` and `npm run start` outcomes.
5. Recommended diagnostic wording direction for each high/medium finding.
6. Confidence: High/Medium/Low with one-sentence justification.

Use these exact heading labels in this order for deterministic review output style:
1. Findings
2. Open Questions/Assumptions
3. Secondary Summary
4. Validation Status
5. Recommended Fix Direction
6. Confidence

If the input is incomplete, proceed with best-effort review and clearly call out confidence limits.