// ============================================================
// Compiler Pipeline Tests — Assertion-based semantic coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : Compiler pipeline modules and test fixtures
// Output : Assertion-based coverage for inference, refinement, elaboration, and evaluation
// Deps   : ast, elaboration, eval, gadt, typechecker, types, unification, node:test

import { beforeEach, test } from "node:test";
import {
  deepStrictEqual,
  equal,
  match,
  ok,
  throws,
} from "node:assert/strict";

import { Expr, MatchBranch } from "./ast";
import { elaborate } from "./elaboration";
import { evaluate } from "./eval";
import { GADTDeclaration, GADTTypeParam, gadtDeclaration } from "./gadt";
import {
  checkExhaustiveness,
  emptyEnv,
  infer,
  registerGADT,
  TypeEnv,
} from "./typechecker";
import { kStar, resetIdCounter, tCon, tVar } from "./types";
import { prettyType } from "./unification";

beforeEach(() => {
  resetIdCounter();
});

/**
 * Build the Expr GADT used across the regression tests.
 *
 * @returns A fresh declaration for the demo expression language.
 */
function buildExprGADT(): GADTDeclaration {
  const a = tVar("a");
  const paramA: GADTTypeParam = { variable: a, kind: kStar };

  return gadtDeclaration("Expr", [paramA], [
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
      fields: [tCon("Expr", [tCon("Bool")]), tCon("Expr", [a]), tCon("Expr", [a])],
      returnType: tCon("Expr", [a]),
      returnIndices: [a],
    },
  ]);
}

/**
 * Create a fresh typing environment populated with the Expr GADT.
 *
 * @returns An environment suitable for semantic pipeline tests.
 */
function createExprEnv(): TypeEnv {
  return registerGADT(emptyEnv(), buildExprGADT());
}

/**
 * Construct an `IntLit` surface expression.
 *
 * @param value - Integer payload for the constructor.
 * @returns A fresh surface expression.
 */
function intLit(value: number): Expr {
  return {
    tag: "EConstruct",
    constructor: "IntLit",
    typeArgs: [],
    args: [{ tag: "ELiteral", value }],
  };
}

/**
 * Construct a `BoolLit` surface expression.
 *
 * @param value - Boolean payload for the constructor.
 * @returns A fresh surface expression.
 */
function boolLit(value: boolean): Expr {
  return {
    tag: "EConstruct",
    constructor: "BoolLit",
    typeArgs: [],
    args: [{ tag: "ELiteral", value }],
  };
}

/**
 * Construct an `Add` surface expression over two integer expressions.
 *
 * @param lhs - Left operand.
 * @param rhs - Right operand.
 * @returns A fresh surface expression.
 */
function addExpr(lhs: Expr, rhs: Expr): Expr {
  return {
    tag: "EConstruct",
    constructor: "Add",
    typeArgs: [],
    args: [lhs, rhs],
  };
}

/**
 * Build a refined match that extracts the payload from an `IntLit` branch.
 *
 * @param scrutinee - Expression matched against `IntLit`.
 * @returns A fresh match expression.
 */
function intMatch(scrutinee: Expr): Expr {
  return {
    tag: "EMatch",
    scrutinee,
    branches: [
      {
        pattern: {
          tag: "PConstructor",
          constructor: "IntLit",
          existentials: [],
          subPatterns: [{ tag: "PVar", name: "n" }],
        },
        body: { tag: "EVar", name: "n" },
      },
    ],
  };
}

/**
 * Build the branch set used for exhaustiveness regression checks.
 *
 * @returns Fresh match branches mirroring the existing demo scenario.
 */
function incompleteExprBranches(): MatchBranch[] {
  return [
    {
      pattern: {
        tag: "PConstructor",
        constructor: "IntLit",
        existentials: [],
        subPatterns: [{ tag: "PVar", name: "n" }],
      },
      body: { tag: "EVar", name: "n" },
    },
    {
      pattern: {
        tag: "PConstructor",
        constructor: "Add",
        existentials: [],
        subPatterns: [
          { tag: "PVar", name: "lhs" },
          { tag: "PVar", name: "rhs" },
        ],
      },
      body: { tag: "ELiteral", value: 0 },
    },
  ];
}

test("infer types constructor applications", () => {
  const env = createExprEnv();
  const expr = addExpr(intLit(1), intLit(2));
  const ty = infer(env, expr);

  equal(prettyType(ty), "Expr<Int>");
});

test("infer applies GADT refinement inside match branches", () => {
  const env = createExprEnv();
  const expr = intMatch(intLit(42));
  const ty = infer(env, expr);

  equal(prettyType(ty), "Int");
});

test("elaboration and evaluation preserve refined branch semantics", () => {
  const env = createExprEnv();
  const expr = intMatch(intLit(42));
  const coreExpr = elaborate(env, expr);
  const value = evaluate(new Map(), coreExpr);

  equal(coreExpr.tag, "CoreCase");
  deepStrictEqual(value, { tag: "VLit", value: 42 });
});

test("infer rejects ill-typed constructor applications", () => {
  const env = createExprEnv();
  const expr = addExpr(boolLit(true), intLit(1));

  throws(() => infer(env, expr), /Cannot unify Bool with Int/);
});

test("exhaustiveness analysis distinguishes missing constructors from wildcard coverage", () => {
  const env = createExprEnv();
  const scrutineeTy = tCon("Expr", [tCon("Int")]);
  const incomplete = checkExhaustiveness(env, scrutineeTy, incompleteExprBranches());
  const wildcardCovered = checkExhaustiveness(env, scrutineeTy, [
    ...incompleteExprBranches(),
    {
      pattern: { tag: "PWildcard" },
      body: { tag: "ELiteral", value: 0 },
    },
  ]);

  equal(incomplete.isExhaustive, false);
  ok(incomplete.missingConstructors.length > 0);
  match(incomplete.missingConstructors.join(","), /BoolLit|Eq|If/);
  equal(wildcardCovered.isExhaustive, true);
  deepStrictEqual(wildcardCovered.missingConstructors, []);
});
