// ============================================================
// AST Tests — Surface node shape and tagging invariants
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : ast node interfaces and type helpers
// Output : Assertion-based checks for expression/pattern discriminants
// Deps   : ast, types, node:test

import { test } from "node:test";
import { deepStrictEqual, equal } from "node:assert/strict";

import { Expr, MatchBranch, Pattern } from "./ast";
import { tCon, tVar, kStar, TypeTag } from "./types";

// ============================================================
// Expression node forms
// ============================================================

test("ELiteral node carries primitive payload", () => {
  const lit: Expr = { tag: "ELiteral", value: 42 };
  equal(lit.tag, "ELiteral");
  if (lit.tag !== "ELiteral") throw new Error("unreachable");
  equal(lit.value, 42);
});

test("ELambda and EApp preserve nested expression structure", () => {
  const lam: Expr = {
    tag: "ELambda",
    param: "x",
    paramType: tCon("Int"),
    body: { tag: "EVar", name: "x" },
  };

  const app: Expr = {
    tag: "EApp",
    func: lam,
    arg: { tag: "ELiteral", value: 7 },
  };

  equal(app.tag, "EApp");
  if (app.tag !== "EApp") throw new Error("unreachable");
  equal(app.func.tag, "ELambda");
  equal(app.arg.tag, "ELiteral");
});

test("EConstruct stores constructor, type arguments, and term args", () => {
  const node: Expr = {
    tag: "EConstruct",
    constructor: "IntLit",
    typeArgs: [tCon("Int")],
    args: [{ tag: "ELiteral", value: 1 }],
  };

  equal(node.tag, "EConstruct");
  if (node.tag !== "EConstruct") throw new Error("unreachable");
  equal(node.constructor, "IntLit");
  equal(node.typeArgs.length, 1);
  equal(node.args.length, 1);
});

test("ETyAbs and ETyApp retain polymorphic expression fields", () => {
  const a = tVar("a");
  const abs: Expr = {
    tag: "ETyAbs",
    typeVar: a,
    kind: kStar,
    body: { tag: "ELiteral", value: 0 },
  };

  const app: Expr = {
    tag: "ETyApp",
    expr: abs,
    typeArg: tCon("Int"),
  };

  equal(abs.tag, "ETyAbs");
  if (abs.tag !== "ETyAbs") throw new Error("unreachable");
  equal(abs.typeVar.name, "a");
  equal(abs.kind.tag, "Star");

  equal(app.tag, "ETyApp");
  if (app.tag !== "ETyApp") throw new Error("unreachable");
  equal(app.expr.tag, "ETyAbs");
  equal(app.typeArg.tag, TypeTag.Constructor);
});

// ============================================================
// Pattern and match branch forms
// ============================================================

test("PConstructor stores subpatterns and existential placeholders", () => {
  const pat: Pattern = {
    tag: "PConstructor",
    constructor: "Cons",
    existentials: [],
    subPatterns: [
      { tag: "PVar", name: "head" },
      { tag: "PWildcard" },
    ],
  };

  equal(pat.tag, "PConstructor");
  if (pat.tag !== "PConstructor") throw new Error("unreachable");
  equal(pat.constructor, "Cons");
  equal(pat.subPatterns.length, 2);
  deepStrictEqual(pat.subPatterns.map((p) => p.tag), ["PVar", "PWildcard"]);
});

test("MatchBranch can carry guard and later refinement metadata", () => {
  const branch: MatchBranch = {
    pattern: { tag: "PVar", name: "x" },
    guard: { tag: "ELiteral", value: true },
    body: { tag: "EVar", name: "x" },
  };

  // Simulate checker-populated branch refinements.
  branch.refinements = [{ lhs: tCon("Int"), rhs: tCon("Int") }];

  equal(branch.pattern.tag, "PVar");
  equal(branch.guard?.tag, "ELiteral");
  equal(branch.body.tag, "EVar");
  equal(branch.refinements?.length, 1);
});
