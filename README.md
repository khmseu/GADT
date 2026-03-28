# GADT Compiler (TypeScript)

A small experimental compiler pipeline for GADTs in TypeScript. The project demonstrates
surface syntax, type/refinement checking, unification, elaboration to a core IR, and evaluation.

## Requirements

- Node.js
- npm

## Setup

```bash
npm install
```

## Build

```bash
npm run build
```

## Run Demo

```bash
npm run start
```

The demo entrypoint is `src/main.ts` (compiled output: `dist/main.js`).

## Project Structure

- `src/ast.ts`: Surface AST
- `src/types.ts`: Types and kinds
- `src/gadt.ts`: GADT declarations and substitutions
- `src/typechecker.ts`: Inference/checking and pattern-match refinement
- `src/unification.ts`: Unification and zonking
- `src/elaboration.ts`: Elaboration to core IR
- `src/ir.ts`: Core IR definitions
- `src/eval.ts`: Evaluation
- `src/prettyprint.ts`: Pretty-printing
- `src/main.ts`: End-to-end wiring/demo

## Development Notes

- The codebase uses tagged unions (`tag` fields) and exhaustive switch handling.
- Keep diagnostics explicit (include constructor/type names in type errors).
- There is currently no dedicated automated test suite; use build + demo (`npm run build` and `npm run start`) as the primary verification path.

## Copilot Customization

Repository-specific Copilot instructions and workflows live under `.github/`:

- `.github/copilot-instructions.md`
- `.github/instructions/`
- `.github/prompts/`
- `.github/agents/`
- `.github/hooks/`
