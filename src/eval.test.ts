// ============================================================
// Evaluator Tests — Core runtime behavior coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : eval and core IR constructors
// Output : Assertion-based checks for application, case dispatch, and type-erasure semantics
// Deps   : eval, types, node:test

import { test } from "node:test";
import { deepStrictEqual, equal, throws } from "node:assert/strict";

import { evaluate, prettyValue, Value } from "./eval";
import { kStar, tCon, tVar } from "./types";

/**
 * Assert that a runtime value is a literal with an expected payload.
 *
 * @param value - Evaluated runtime value.
 * @param expected - Expected literal payload.
 */
function expectLiteral(value: Value, expected: number | boolean | string): void {
  equal(value.tag, "VLit");
  if (value.tag !== "VLit") {
    throw new Error("Expected literal value");
  }
  equal(value.value, expected);
}

test("evaluate applies closures to arguments", () => {
  const expr = {
    tag: "CoreApp" as const,
    func: {
      tag: "CoreLam" as const,
      param: "x",
      paramType: tCon("Int"),
      body: {
        tag: "CoreVar" as const,
        name: "x",
        type: tCon("Int"),
      },
      type: tCon("Fn"),
    },
    arg: {
      tag: "CoreLit" as const,
      value: 7,
      type: tCon("Int"),
    },
    type: tCon("Int"),
  };

  const result = evaluate(new Map(), expr);
  expectLiteral(result, 7);
});

test("evaluate case uses wildcard binding when no constructor branch matches", () => {
  const expr = {
    tag: "CoreCase" as const,
    scrutinee: {
      tag: "CoreConstruct" as const,
      constructor: "IntLit",
      typeArgs: [],
      args: [{ tag: "CoreLit" as const, value: 42, type: tCon("Int") }],
      type: tCon("Expr", [tCon("Int")]),
    },
    scrutineeType: tCon("Expr", [tCon("Int")]),
    alternatives: [
      {
        constructor: "@wildcard",
        existentials: [],
        coercions: [],
        bindings: [{ name: "v", type: tCon("Expr", [tCon("Int")]) }],
        body: {
          tag: "CoreVar" as const,
          name: "v",
          type: tCon("Expr", [tCon("Int")]),
        },
      },
    ],
    resultType: tCon("Expr", [tCon("Int")]),
  };

  const result = evaluate(new Map(), expr);
  deepStrictEqual(result, {
    tag: "VConstruct",
    constructor: "IntLit",
    args: [{ tag: "VLit", value: 42 }],
  });
});

test("evaluate erases type abstractions through CoreTyApp", () => {
  const a = tVar("a");
  const expr = {
    tag: "CoreTyApp" as const,
    expr: {
      tag: "CoreTyLam" as const,
      typeVar: a,
      kind: kStar,
      body: {
        tag: "CoreLit" as const,
        value: "ok",
        type: tCon("String"),
      },
      type: tCon("Poly"),
    },
    typeArg: tCon("Int"),
    type: tCon("String"),
  };

  const result = evaluate(new Map(), expr);
  expectLiteral(result, "ok");
});

test("evaluate rejects application of non-closure values", () => {
  const expr = {
    tag: "CoreApp" as const,
    func: {
      tag: "CoreLit" as const,
      value: 1,
      type: tCon("Int"),
    },
    arg: {
      tag: "CoreLit" as const,
      value: 2,
      type: tCon("Int"),
    },
    type: tCon("Int"),
  };

  throws(() => evaluate(new Map(), expr), /Application of non-function/);
});

test("prettyValue renders nested constructor payloads", () => {
  const value: Value = {
    tag: "VConstruct",
    constructor: "Pair",
    args: [
      { tag: "VLit", value: 1 },
      {
        tag: "VConstruct",
        constructor: "IntLit",
        args: [{ tag: "VLit", value: 2 }],
      },
    ],
  };

  equal(prettyValue(value), "Pair(1, IntLit(2))");
});
