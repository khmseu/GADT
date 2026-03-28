---
description: "Add or update a GADT pattern-match branch with sound type refinement, elaboration alignment, and demo validation."
name: "Add GADT Match Branch"
argument-hint: "Match-branch spec (target expression/function, pattern constructor, branch variables, branch body intent, and expected result type)"
agent: "GADT Pipeline Specialist"
---
Implement a new or revised GADT match branch in this repository using the provided argument as the specification.

Use the argument text as the source of truth for:
- target location for the match update
- pattern constructor and bound variables
- branch body behavior
- expected type behavior and result type
- one demo scenario that should exercise the branch

Follow project guidance in:
- [Workspace Guidelines](../copilot-instructions.md)
- [Typechecker Refinement Rules](../instructions/typechecker-refinement.instructions.md)

Touch only files required for a sound pipeline update. Typical touchpoints:
- [src/ast.ts](../../src/ast.ts)
- [src/typechecker.ts](../../src/typechecker.ts)
- [src/unification.ts](../../src/unification.ts)
- [src/elaboration.ts](../../src/elaboration.ts)
- [src/ir.ts](../../src/ir.ts)
- [src/eval.ts](../../src/eval.ts)
- [src/prettyprint.ts](../../src/prettyprint.ts)
- [src/main.ts](../../src/main.ts)

Execution requirements:
1. Preserve tagged-union and exhaustive-switch conventions.
2. Apply constructor-derived refinements before inferring the branch body.
3. Ensure all branch result types are unified and zonked before returning.
4. Keep diagnostics explicit with constructor/type names where relevant.
5. Run npm run build.
6. Run npm run start when runtime or demo-visible behavior changes.

Final response format:
1. Branch change summary.
2. Files changed with one-line rationale each.
3. Validation commands and outcomes.
4. Any assumptions taken due to ambiguity in the branch specification.

If the branch specification is incomplete, choose the safest type-sound behavior, continue implementation, and clearly state assumptions in the final response.
