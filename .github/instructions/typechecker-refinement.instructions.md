---
description: "Use when editing GADT type refinement, pattern matching, unification, zonking, or type error diagnostics in the typechecker pipeline."
name: "Typechecker Refinement Rules"
applyTo: "src/typechecker.ts, src/unification.ts"
---
# Typechecker Refinement Guidelines

- Preserve soundness first: introduce refinements only from constructor constraints and explicit equality evidence.
- Keep refinement flow explicit through `TypeEquality[]` and existing unification entry points; avoid ad-hoc side channels.
- Maintain exhaustive handling of tagged unions with explicit `switch` branches and fail-fast errors for impossible states.
- Prefer extending existing helpers before adding parallel inference/unification paths.
- Keep diagnostics type-oriented and specific: include constructor names and compared types in errors.
- After non-trivial changes, run:
  - `npm run build`
  - `npm run start` (to verify demo behavior in `src/main.ts`)
- When adjusting matching logic, verify both:
  - branch-local refinement is applied before branch body inference
  - branch result types are unified and zonked before returning
