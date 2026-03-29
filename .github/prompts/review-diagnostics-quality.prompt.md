---
description: "Use when auditing GADT error-message clarity and consistency without implementing fixes. Trigger phrases: review diagnostics quality, error message audit, diagnostics consistency check, type error wording review."
name: "Review Diagnostics Quality"
argument-hint: "Describe changed files/diff, failing scenarios, and diagnostics you want evaluated."
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

Validation expectations:

- Run `npm run build` when feasible.
- Run `npm run start` when diagnostics are demonstrated via demo/runtime behavior.
- If commands cannot be run, state that explicitly and treat it as residual risk.

Required output format:

1. Findings (ordered by severity): include risk, impact, and file references.
2. Open questions or assumptions (only if needed).
3. Secondary summary: brief recap after findings.
4. Validation status: commands run and outcomes.
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
