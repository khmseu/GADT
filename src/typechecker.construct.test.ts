// ============================================================
// Typechecker Construct Tests — Constructor inference diagnostics
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : infer and GADT constructor registration helpers
// Output : Assertion-based coverage for constructor inference success and errors
// Deps   : gadt, typechecker, types, unification, node:test

import { beforeEach, test } from "node:test";
import { equal, throws } from "node:assert/strict";

import { GADTDeclaration, GADTTypeParam, gadtDeclaration } from "./gadt";
import { emptyEnv, infer, registerGADT, TypeEnv } from "./typechecker";
import { kStar, resetIdCounter, tCon, tVar } from "./types";
import { prettyType } from "./unification";

beforeEach(() => {
  resetIdCounter();
});

// ============================================================
// Helpers
// ============================================================

/**
 * Build the Expr GADT used for constructor inference tests.
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
 * Create an environment populated with Expr constructors.
 *
 * @returns Fresh type environment.
 */
function createExprEnv(): TypeEnv {
  return registerGADT(emptyEnv(), buildExprGADT());
}

// ============================================================
// Constructor inference
// ============================================================

test("infer EConstruct rejects unknown constructors", () => {
  const env = createExprEnv();

  throws(
    () =>
      infer(env, {
        tag: "EConstruct",
        constructor: "MissingCtor",
        typeArgs: [],
        args: [],
      }),
    /Unknown constructor: MissingCtor/,
  );
});

test("infer EConstruct rejects wrong argument count", () => {
  const env = createExprEnv();

  throws(
    () =>
      infer(env, {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [],
      }),
    /Constructor IntLit expects 1 args, got 0/,
  );
});

test("infer EConstruct checks argument types against constructor fields", () => {
  const env = createExprEnv();

  throws(
    () =>
      infer(env, {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: true }],
      }),
    /Cannot unify Bool with Int|Cannot unify Int with Bool/,
  );
});

test("infer EConstruct infers missing type arguments from constructor fields", () => {
  const env = createExprEnv();

  const result = infer(env, {
    tag: "EConstruct",
    constructor: "If",
    typeArgs: [],
    args: [
      {
        tag: "EConstruct",
        constructor: "BoolLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: true }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 1 }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 0 }],
      },
    ],
  });

  equal(prettyType(result), "Expr<Int>");
});

test("infer EConstruct respects explicit type arguments when they are consistent", () => {
  const env = createExprEnv();

  const result = infer(env, {
    tag: "EConstruct",
    constructor: "If",
    typeArgs: [tCon("Int")],
    args: [
      {
        tag: "EConstruct",
        constructor: "BoolLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: true }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 1 }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 2 }],
      },
    ],
  });

  equal(prettyType(result), "Expr<Int>");
});
