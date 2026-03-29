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

## Test

```bash
npm test
```

This repository ships with a real assertion-based test suite built on Node's
built-in test runner. The test command compiles the project and runs the
compiled `*.test.js` files from `dist/`.

## Demo Smoke Test

```bash
npm run test:demo
```

The demo smoke path is kept separate from `npm test`. It compiles the compiler
and executes the end-to-end sample program in `src/main.ts`.

## Run Demo

```bash
npm run start
```

The demo entrypoint is `src/main.ts` (compiled output: `dist/main.js`).

## Project Structure

Architecture deep dive: [docs/architecture.md](docs/architecture.md)
Terminology quick reference: [docs/glossary.md](docs/glossary.md)

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
- `npm test` runs the real assertion-based test suite after compiling to `dist/`.
- `npm run test:demo` preserves the demo-based smoke verification path.
- GitHub Actions runs both the real test suite and the demo smoke path on every push.

## Copilot Customization

Repository-specific Copilot instructions and workflows live under `.github/`:

- `.github/copilot-instructions.md`
- `.github/instructions/`
- `.github/prompts/`
- `.github/agents/`
- `.github/hooks/`
