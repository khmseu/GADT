// ============================================================
// Typechecker Exhaustiveness Tests — Match coverage regressions
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : typechecker exhaustiveness API and match branch fixtures
// Output : Assertion-based coverage for missing and redundant branch detection
// Deps   : ast, gadt, typechecker, types, node:test

import { test } from "node:test";
import { deepStrictEqual, equal } from "node:assert/strict";

import { MatchBranch } from "./ast";
import { GADTDeclaration, GADTTypeParam, gadtDeclaration } from "./gadt";
import {
  checkExhaustiveness,
  emptyEnv,
  registerGADT,
  TypeEnv,
} from "./typechecker";
import { kStar, resetIdCounter, tCon, tVar } from "./types";

/**
 * Build the Expr GADT used to validate constructor coverage analysis.
 *
 * @returns A fresh Expr declaration for each test.
 */
function buildExprGADT(): GADTDeclaration {
  const a = tVar("a");
  const paramA: GADTTypeParam = { variable: a, kind: kStar };

  return gadtDeclaration(
    "Expr",
    [paramA],
    [
      {
        name: "IntLit",
        existentials: [],
        constraints: [{ lhs: a, rhs: tCon("Int") }],
        fields: [tCon("Int")],
        returnType: tCon("Expr", [tCon("Int")]),
        returnIndices: [tCon("Int")],
      },
      {
        name: "BoolLit",
        existentials: [],
        constraints: [{ lhs: a, rhs: tCon("Bool") }],
        fields: [tCon("Bool")],
        returnType: tCon("Expr", [tCon("Bool")]),
        returnIndices: [tCon("Bool")],
      },
      {
        name: "Add",
        existentials: [],
        constraints: [{ lhs: a, rhs: tCon("Int") }],
        fields: [tCon("Expr", [tCon("Int")]), tCon("Expr", [tCon("Int")])],
        returnType: tCon("Expr", [tCon("Int")]),
        returnIndices: [tCon("Int")],
      },
      {
        name: "Eq",
        existentials: [],
        constraints: [{ lhs: a, rhs: tCon("Bool") }],
        fields: [tCon("Expr", [tCon("Int")]), tCon("Expr", [tCon("Int")])],
        returnType: tCon("Expr", [tCon("Bool")]),
        returnIndices: [tCon("Bool")],
      },
      {
        name: "If",
        existentials: [],
        constraints: [],
        fields: [
          tCon("Expr", [tCon("Bool")]),
          tCon("Expr", [a]),
          tCon("Expr", [a]),
        ],
        returnType: tCon("Expr", [a]),
        returnIndices: [a],
      },
    ],
  );
}

/**
 * Build a typed environment with Expr constructors registered.
 *
 * @returns Fresh environment for exhaustiveness assertions.
 */
function createExprEnv(): TypeEnv {
  resetIdCounter();
  return registerGADT(emptyEnv(), buildExprGADT());
}

/**
 * Build a duplicate-constructor branch list to test redundancy reporting.
 *
 * @returns Branches where the second IntLit branch is redundant.
 */
function duplicateIntLitBranches(): MatchBranch[] {
  return [
    {
      pattern: {
        tag: "PConstructor",
        constructor: "IntLit",
        existentials: [],
        subPatterns: [{ tag: "PVar", name: "n1" }],
      },
      body: { tag: "ELiteral", value: 1 },
    },
    {
      pattern: {
        tag: "PConstructor",
        constructor: "IntLit",
        existentials: [],
        subPatterns: [{ tag: "PVar", name: "n2" }],
      },
      body: { tag: "ELiteral", value: 2 },
    },
  ];
}

test("checkExhaustiveness reports duplicate constructor branches as redundant", () => {
  const env = createExprEnv();
  const scrutineeTy = tCon("Expr", [tCon("Int")]);

  const result = checkExhaustiveness(
    env,
    scrutineeTy,
    duplicateIntLitBranches(),
  );

  equal(result.isExhaustive, false);
  deepStrictEqual(result.redundantBranches, [1]);
  deepStrictEqual(result.missingConstructors.sort(), [
    "Add",
    "BoolLit",
    "Eq",
    "If",
  ]);
});

test("checkExhaustiveness treats non-GADT scrutinee types as trivially exhaustive", () => {
  const env = createExprEnv();
  const scrutineeTy = tCon("Int");

  const result = checkExhaustiveness(
    env,
    scrutineeTy,
    duplicateIntLitBranches(),
  );

  equal(result.isExhaustive, true);
  deepStrictEqual(result.missingConstructors, []);
  deepStrictEqual(result.redundantBranches, []);
});

test("checkExhaustiveness treats wildcard branch as covering all inhabitable constructors", () => {
  const env = createExprEnv();
  const scrutineeTy = tCon("Expr", [tCon("Int")]);

  const result = checkExhaustiveness(env, scrutineeTy, [
    {
      pattern: { tag: "PWildcard" },
      body: { tag: "ELiteral", value: 0 },
    },
  ]);

  equal(result.isExhaustive, true);
  deepStrictEqual(result.missingConstructors, []);
  deepStrictEqual(result.redundantBranches, []);
});

test("checkExhaustiveness treats variable pattern as covering all inhabitable constructors", () => {
  const env = createExprEnv();
  const scrutineeTy = tCon("Expr", [tCon("Int")]);

  const result = checkExhaustiveness(env, scrutineeTy, [
    {
      pattern: { tag: "PVar", name: "expr" },
      body: { tag: "ELiteral", value: 0 },
    },
  ]);

  equal(result.isExhaustive, true);
  deepStrictEqual(result.missingConstructors, []);
  deepStrictEqual(result.redundantBranches, []);
});

test("checkExhaustiveness marks constructor branches after wildcard as redundant", () => {
  const env = createExprEnv();
  const scrutineeTy = tCon("Expr", [tCon("Int")]);

  const result = checkExhaustiveness(env, scrutineeTy, [
    {
      pattern: { tag: "PWildcard" },
      body: { tag: "ELiteral", value: 0 },
    },
    {
      pattern: {
        tag: "PConstructor",
        constructor: "IntLit",
        existentials: [],
        subPatterns: [{ tag: "PWildcard" }],
      },
      body: { tag: "ELiteral", value: 1 },
    },
  ]);

  equal(result.isExhaustive, true);
  deepStrictEqual(result.missingConstructors, []);
  deepStrictEqual(result.redundantBranches, [1]);
});
