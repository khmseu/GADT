// ============================================================
// Typechecker Match Tests — Guard and pattern diagnostic coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : infer and match-related typechecker paths
// Output : Assertion-based coverage for guards, constructor-pattern errors,
//          and variable-pattern typing
// Deps   : ast, gadt, typechecker, types, unification, node:test

import { beforeEach, test } from "node:test";
import { equal, throws } from "node:assert/strict";

import { GADTDeclaration, GADTTypeParam, gadtDeclaration } from "./gadt";
import { emptyEnv, infer, registerGADT, TypeEnv } from "./typechecker";
import { kStar, resetIdCounter, tCon, tVar } from "./types";
import { prettyType } from "./unification";

beforeEach(() => {
  resetIdCounter();
});

/**
 * Build the Expr GADT used for match-specific typechecker tests.
 *
 * @returns Fresh Expr declaration.
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
  ]);
}

/**
 * Create an environment populated with Expr constructors.
 *
 * @returns Fresh type environment.
 */
function createExprEnv(): TypeEnv {
  return registerGADT(emptyEnv(), buildExprGADT());
}

test("infer match accepts Bool guards and returns branch type", () => {
  const env = createExprEnv();
  const expr = {
    tag: "EMatch" as const,
    scrutinee: {
      tag: "EConstruct" as const,
      constructor: "IntLit",
      typeArgs: [],
      args: [{ tag: "ELiteral" as const, value: 1 }],
    },
    branches: [
      {
        pattern: {
          tag: "PConstructor" as const,
          constructor: "IntLit",
          existentials: [],
          subPatterns: [{ tag: "PVar" as const, name: "n" }],
        },
        guard: { tag: "ELiteral" as const, value: true },
        body: { tag: "EVar" as const, name: "n" },
      },
    ],
  };

  equal(prettyType(infer(env, expr)), "Int");
});

test("infer match rejects non-Bool guards", () => {
  const env = createExprEnv();
  const expr = {
    tag: "EMatch" as const,
    scrutinee: {
      tag: "EConstruct" as const,
      constructor: "IntLit",
      typeArgs: [],
      args: [{ tag: "ELiteral" as const, value: 1 }],
    },
    branches: [
      {
        pattern: {
          tag: "PConstructor" as const,
          constructor: "IntLit",
          existentials: [],
          subPatterns: [{ tag: "PVar" as const, name: "n" }],
        },
        guard: { tag: "ELiteral" as const, value: 0 },
        body: { tag: "EVar" as const, name: "n" },
      },
    ],
  };

  throws(() => infer(env, expr), /Cannot unify|Int|Bool/);
});

test("infer match with variable pattern binds scrutinee type in body", () => {
  const env = createExprEnv();
  const expr = {
    tag: "EMatch" as const,
    scrutinee: { tag: "ELiteral" as const, value: 7 },
    branches: [
      {
        pattern: { tag: "PVar" as const, name: "x" },
        body: { tag: "EVar" as const, name: "x" },
      },
    ],
  };

  equal(prettyType(infer(env, expr)), "Int");
});

test("infer match rejects unknown constructors in patterns", () => {
  const env = createExprEnv();
  const expr = {
    tag: "EMatch" as const,
    scrutinee: {
      tag: "EConstruct" as const,
      constructor: "IntLit",
      typeArgs: [],
      args: [{ tag: "ELiteral" as const, value: 1 }],
    },
    branches: [
      {
        pattern: {
          tag: "PConstructor" as const,
          constructor: "MissingCtor",
          existentials: [],
          subPatterns: [],
        },
        body: { tag: "ELiteral" as const, value: 0 },
      },
    ],
  };

  throws(() => infer(env, expr), /Unknown constructor in pattern: MissingCtor/);
});

test("infer match rejects constructor patterns with wrong arity", () => {
  const env = createExprEnv();
  const expr = {
    tag: "EMatch" as const,
    scrutinee: {
      tag: "EConstruct" as const,
      constructor: "Add",
      typeArgs: [],
      args: [
        {
          tag: "EConstruct" as const,
          constructor: "IntLit",
          typeArgs: [],
          args: [{ tag: "ELiteral" as const, value: 1 }],
        },
        {
          tag: "EConstruct" as const,
          constructor: "IntLit",
          typeArgs: [],
          args: [{ tag: "ELiteral" as const, value: 2 }],
        },
      ],
    },
    branches: [
      {
        pattern: {
          tag: "PConstructor" as const,
          constructor: "Add",
          existentials: [],
          subPatterns: [{ tag: "PWildcard" as const }],
        },
        body: { tag: "ELiteral" as const, value: 0 },
      },
    ],
  };

  throws(() => infer(env, expr), /Constructor Add has 2 fields, but pattern has 1 sub-patterns/);
});
