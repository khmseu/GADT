---
description: "Add a new GADT constructor end-to-end across typing, elaboration, evaluation, and demo wiring."
name: "Add GADT Constructor"
argument-hint: "Constructor spec (GADT name, constructor name, fields, constraints, return indices, and example usage)"
agent: "GADT Pipeline Specialist"
---

Implement a new GADT constructor in this repository using the user-provided constructor specification.

Use the argument text as the source of truth for:

- target GADT
- constructor name
- field types
- type equalities/constraints
- return indices
- one example expression to build in the demo

Follow project guidance in:

- [Workspace Guidelines](../copilot-instructions.md)
- [Typechecker Refinement Rules](../instructions/typechecker-refinement.instructions.md)

Update only the files needed by the constructor semantics. Typical touchpoints:

- [src/gadt.ts](../../src/gadt.ts)
- [src/ast.ts](../../src/ast.ts)
- [src/types.ts](../../src/types.ts)
- [src/typechecker.ts](../../src/typechecker.ts)
- [src/unification.ts](../../src/unification.ts)
- [src/elaboration.ts](../../src/elaboration.ts)
- [src/ir.ts](../../src/ir.ts)
- [src/eval.ts](../../src/eval.ts)
- [src/prettyprint.ts](../../src/prettyprint.ts)
- [src/main.ts](../../src/main.ts)

Execution requirements:

1. Implement the constructor with minimal, cohesive changes.
2. Preserve existing tagged-union and exhaustive-switch style.
3. Keep refinement flow explicit via existing `TypeEquality[]` and unification helpers.
4. Add or update demo wiring so the new constructor is exercised.
5. Run `npm run build`.
6. Run `npm run start` if behavior changed in demo or runtime pipeline.

Final response format:

1. Constructor implemented summary.
2. Files changed with one-line rationale each.
3. Validation commands run and outcomes.
4. Any assumptions made from ambiguous constructor specs.

If the constructor specification is ambiguous or incomplete, make the safest type-sound choice, proceed, and state assumptions clearly in the final response.
