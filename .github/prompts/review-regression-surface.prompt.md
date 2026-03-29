---
description: "Use when reviewing broader GADT behavior regressions across typechecker, elaboration, eval, and demo integration beyond diagnostics-only checks. Trigger phrases: review regression surface, behavior drift audit, cross-stage regression review, end-to-end pipeline sanity check."
name: "Review Regression Surface"
argument-hint: "Describe changed files/diff, expected behavior, observed drift, and any suspected pipeline stage."
agent: "GADT Regression Auditor"
---

Review the provided change set for broader behavior/regression risk across the GADT pipeline.

This prompt is for analysis/audit output only. Do not implement code changes unless explicitly requested.

Use the argument text as input for:

- changed files or diff context
- expected behavior and observed behavior drift
- suspected stage interactions or symptoms (if known)

Apply project-specific guidance from:

- [Workspace Guidelines](../copilot-instructions.md)
- [Typechecker Refinement Rules](../instructions/typechecker-refinement.instructions.md)
- [GADT Regression Auditor](../agents/gadt-regression-audit.agent.md)

Review focus:

1. Cross-stage regressions from typechecker/unification into elaboration and runtime behavior.
2. Behavioral drift between expected typed semantics and eval/main demo output.
3. Constructor branch handling mismatches that surface only after lowering/evaluation.
4. Integration regressions where stage-local correctness still produces wrong end-to-end behavior.
5. Confidence level and blind spots from incomplete context.

Validation expectations:

- Run `npm run build` when feasible.
- Run `npm run start` when runtime/demo behavior is part of the reviewed changes.
- If commands cannot be run, state that explicitly and treat it as residual risk.

Required output format:

1. Findings (ordered by severity): include risk, impact, and file references.
2. Reproduction Notes: minimal steps/signals for each high/medium finding.
3. Open questions or assumptions (only if needed).
4. Secondary summary: brief recap after findings.
5. Validation status: commands run and outcomes.
6. Recommended fix direction for each high/medium finding.
7. Confidence and gaps: High/Medium/Low with explicit blind spots.

Use these exact heading labels in this order for deterministic review output style:

1. Findings
2. Reproduction Notes
3. Open Questions/Assumptions
4. Secondary Summary
5. Validation Status
6. Recommended Fix Direction
7. Confidence and Gaps

If the input is incomplete, proceed with best-effort review and clearly call out confidence limits.
