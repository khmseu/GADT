---
description: "Use when running a strict end-to-end GADT regression audit that must include mandatory build and start validation. Trigger phrases: strict regression review, final gate regression audit, always validate regression audit."
name: "Review Regression Surface Strict"
argument-hint: "Describe changed files/diff, expected behavior, observed drift, and any suspected pipeline stage."
agent: "GADT Regression Auditor"
---

# Review Regression Surface Strict

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

Strict validation requirements:

- Mandatory command execution:
  - `npm run build`
  - `npm run start`
- Do not skip either command.
- If a command cannot be run, mark validation verdict as `incomplete` and escalate unresolved regression risk as High.

Required output format:

1. Findings (ordered by severity): include risk, impact, and file references.
2. Reproduction Notes: required for every high/medium finding.
3. Open questions or assumptions (only if needed).
4. Secondary summary: brief recap after findings.
5. Command Validation: include both commands, exit status, and one-line outcomes.
6. Validation Verdict: `pass`, `incomplete`, or `fail`.
7. Recommended fix direction for each high/medium finding.
8. Confidence and gaps: High/Medium/Low with explicit blind spots.

Use these exact heading labels in this order for deterministic review output style:

1. Findings
2. Reproduction Notes
3. Open Questions/Assumptions
4. Secondary Summary
5. Command Validation
6. Validation Verdict
7. Recommended Fix Direction
8. Confidence and Gaps

If the input is incomplete, proceed with best-effort review and clearly call out confidence limits.
