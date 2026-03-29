# Project Guidelines

## Code Style

- Use TypeScript `strict` mode patterns already used in the repo (`tag`-based discriminated unions, explicit interfaces, and exhaustive `switch` branches).
- Keep module boundaries clear: each file owns one compiler stage or data model.
- Prefer extending existing tagged unions over introducing parallel ad-hoc representations.

## Architecture

This repository is a small GADT compiler pipeline:

- Surface syntax in `src/ast.ts`
- Type and kind definitions in `src/types.ts`
- GADT declarations and substitutions in `src/gadt.ts`
- Inference/checking and pattern-match refinement in `src/typechecker.ts`
- Unification and zonking in `src/unification.ts`
- Elaboration to core IR in `src/elaboration.ts`
- Core IR definitions in `src/ir.ts`
- Evaluation in `src/eval.ts`
- Pretty-printing in `src/prettyprint.ts`
- End-to-end demo wiring in `src/main.ts`

## Build And Run

- Install dependencies: `npm install`
- Build: `npm run build`
- Run demo: `npm run start`

Agents should run `npm run build` after non-trivial type-system or IR changes.

## Conventions

- Constructor and expression variants are modeled with `tag` string literals; preserve this style for all new AST/type/IR nodes.
- GADT type refinement flows through `TypeEquality[]` and unification. Keep new pattern-matching logic consistent with existing refinement handling in `src/typechecker.ts` and `src/unification.ts`.
- Keep diagnostic text explicit and type-oriented (include constructor/type names in errors).
- Compiled output belongs in `dist/`; source files remain in `src/`.

## Project Notes

- There is currently no dedicated automated test suite; verify behavior through the build + demo pipeline in `src/main.ts`.
