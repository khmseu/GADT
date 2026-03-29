// ============================================================
// Main Tests — Demo wiring and console output smoke coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : compiled main entrypoint and Node child-process execution
// Output : Assertion-based checks for end-to-end demo output structure
// Deps   : node:test, node:child_process, node:path, main

import { test } from "node:test";
import { match } from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * Execute the compiled demo entrypoint and return its stdout.
 *
 * @returns Captured stdout from `dist/main.js`.
 */
function runDemo(): string {
  const entry = resolve(__dirname, "main.js");
  return execFileSync(process.execPath, [entry], { encoding: "utf8" });
}

test("main demo prints expected section headings and key outcomes", () => {
  const output = runDemo();

  match(output, /Full GADT Compiler/);
  match(output, /GADT Declarations/);
  match(output, /Demo 1: Constructing GADT values/);
  match(output, /Demo 2: GADT Pattern Matching with Type Refinement/);
  match(output, /Demo 3: Elaboration to Core IR/);
  match(output, /Demo 4: Evaluation/);
  match(output, /Demo 5: Exhaustiveness Checking/);
  match(output, /Demo 6: Type Equality Witness \(Refl\)/);
  match(output, /Demo 7: Type Safety/);
  match(output, /Summary/);
});

test("main demo reports expected semantic milestones", () => {
  const output = runDemo();

  match(output, /Add \(IntLit 1\) \(IntLit 2\) : Expr<Int>/);
  match(output, /Pattern match result type: Int/);
  match(output, /IntLit\(42\) evaluates to: IntLit\(42\)|42/);
  match(output, /Missing constructors: \[BoolLit, Eq, If\]/);
  match(output, /With wildcard — Exhaustive: true/);
  match(output, /Refl @Int : Equal<Int, Int>/);
  match(output, /Correctly rejected: Add \(BoolLit true\) \(IntLit 1\)/);
});
