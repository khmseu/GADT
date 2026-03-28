---
description: "Review-only audit for GADT refinement and unification changes, focused on soundness risks, regressions, and diagnostics quality."
name: "Review Refinement Soundness"
argument-hint: "Describe changed files/diff, expected behavior, and any suspicious branches or errors."
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

Validation expectations:
- Run `npm run build` when feasible.
- Run `npm run start` when runtime/demo behavior is part of the reviewed changes.
- If commands cannot be run, state that explicitly and treat it as residual risk.

Required output format:
1. Findings (ordered by severity): include risk, impact, and file references.
2. Open questions or assumptions (only if needed).
3. Secondary summary: brief recap after findings.
4. Validation status: commands run and outcomes.
5. Recommended fix direction for each high/medium finding.
6. Confidence: High/Medium/Low with one-sentence justification.

If the input is incomplete, proceed with best-effort review and clearly call out confidence limits.

Strict variant (always command-validated):
- Use this variant when the request includes strict validation intent (for example: "strict", "always validate", or "final gate review").
- Mandatory commands:
	- `npm run build`
	- `npm run start`
- Do not skip either command. If a command cannot be run, mark the review as validation-incomplete and treat all findings confidence as capped at Medium.

Strict variant output additions:
1. Command Validation (mandatory): include both commands, exit status, and a one-line outcome each.
2. Validation Verdict: `pass` only if both commands were executed and succeeded; otherwise `incomplete` or `fail`.
3. Residual Risk Escalation: if verdict is not `pass`, explicitly mark unresolved regression risk as High.
