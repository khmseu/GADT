---
description: "Use when running strict refinement-soundness audits that must include mandatory build and start validation. Trigger phrases: strict refinement review, refinement soundness strict, always validate refinement audit, final gate refinement review."
name: "Review Refinement Soundness (Strict)"
argument-hint: "Describe changed files/diff, expected behavior, and any suspicious branches or errors for strict validation audit."
agent: "GADT Refinement Reviewer"
---
Review the provided change set for refinement soundness in this repository.

This prompt is for analysis/audit output only. Do not implement code changes unless explicitly requested.

Use the argument text as input for:
- changed files or diff context
- expected behavior
- known suspicious paths (if any)

Apply project-specific guidance from:
- [Workspace Guidelines](../copilot-instructions.md)
- [Typechecker Refinement Rules](../instructions/typechecker-refinement.instructions.md)
- [GADT Refinement Reviewer](../agents/gadt-refinement-review.agent.md)

Review focus:
1. Unsound or missing refinement propagation in pattern matching.
2. Regressions in unification/zonking behavior.
3. Branch result type compatibility and post-unification zonking.
4. Diagnostic quality and clarity (constructor/type names in errors).
5. Exhaustiveness and impossible-state handling in tagged-union switches.
6. Review confidence level and any blind spots from incomplete context.

Strict validation requirements:
- Always run `npm run build`.
- Always run `npm run start`.
- Do not skip either command.
- If a command cannot be run, mark the review as validation-incomplete and treat all findings confidence as capped at Medium.

Required output format with strict validation sections:
1. Findings (ordered by severity): include risk, impact, and file references.
2. Open questions or assumptions (only if needed).
3. Secondary summary: brief recap after findings.
4. Command Validation (mandatory): include both commands, exit status, and a one-line outcome each.
5. Validation Verdict: `pass` only if both commands were executed and succeeded; otherwise `incomplete` or `fail`.
6. Recommended fix direction for each high/medium finding.
7. Confidence: High/Medium/Low with one-sentence justification.
8. Residual Risk Escalation: if verdict is not `pass`, explicitly mark unresolved regression risk as High.

Use these exact heading labels in this order for deterministic review output style:
1. Findings
2. Open Questions/Assumptions
3. Secondary Summary
4. Command Validation
5. Validation Verdict
6. Recommended Fix Direction
7. Confidence
8. Residual Risk Escalation

If the input is incomplete, proceed with best-effort review and clearly call out confidence limits.
