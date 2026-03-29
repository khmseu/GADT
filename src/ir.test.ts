// ============================================================
// IR Tests — Coercion smart constructors and prettyCoreExpr
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : ir, prettyprint, types
// Output : Assertion-based checks for coercion algebra and core IR
//          pretty-printing
// Deps   : ir, prettyprint, types, node:test

import { beforeEach, test } from "node:test";
import { equal, match } from "node:assert/strict";

import {
  coAxiom,
  coRefl,
  coSym,
  coTrans,
  Coercion,
  CoreExpr,
} from "./ir";
import { prettyCoreExpr, prettyCoercion } from "./prettyprint";
import { resetIdCounter, tCon, tArrow, tVar, kStar } from "./types";

beforeEach(() => {
  resetIdCounter();
});

// ============================================================
// coRefl
// ============================================================

test("coRefl produces a CoRefl node with the given type", () => {
  const c = coRefl(tCon("Int"));
  equal(c.tag, "CoRefl");
  if (c.tag !== "CoRefl") throw new Error("unreachable");
  equal(c.type.tag, "Constructor");
});

// ============================================================
// coSym
// ============================================================

test("coSym eliminates double negation for CoRefl", () => {
  const r = coRefl(tCon("Bool"));
  // coSym of a CoRefl returns the same CoRefl (simplification)
  const s = coSym(r);
  equal(s.tag, "CoRefl");
});

test("coSym eliminates double negation for CoSym", () => {
  const ax = coAxiom("test_eq", tCon("Int"), tCon("Bool"));
  const s1 = coSym(ax);
  const s2 = coSym(s1);
  // sym(sym(c)) == c
  equal(s2, ax);
});

test("coSym wraps a non-reflexive coercion in CoSym", () => {
  const ax = coAxiom("pair_eq", tCon("Int"), tCon("String"));
  const s = coSym(ax);
  equal(s.tag, "CoSym");
  if (s.tag !== "CoSym") throw new Error("unreachable");
  equal(s.coercion, ax);
});

// ============================================================
// coTrans
// ============================================================

test("coTrans with leading CoRefl returns the second coercion", () => {
  const r = coRefl(tCon("Int"));
  const ax = coAxiom("step", tCon("Int"), tCon("Bool"));
  const t = coTrans(r, ax);
  equal(t, ax);
});

test("coTrans with trailing CoRefl returns the first coercion", () => {
  const ax = coAxiom("step", tCon("Int"), tCon("Bool"));
  const r = coRefl(tCon("Bool"));
  const t = coTrans(ax, r);
  equal(t, ax);
});

test("coTrans of two non-refl coercions produces CoTrans", () => {
  const c1 = coAxiom("a_eq", tCon("Int"), tCon("String"));
  const c2 = coAxiom("b_eq", tCon("String"), tCon("Bool"));
  const t = coTrans(c1, c2);
  equal(t.tag, "CoTrans");
  if (t.tag !== "CoTrans") throw new Error("unreachable");
  equal(t.first, c1);
  equal(t.second, c2);
});

// ============================================================
// prettyCoercion
// ============================================================

test("prettyCoercion renders CoRefl correctly", () => {
  equal(prettyCoercion(coRefl(tCon("Int"))), "refl(Int)");
});

test("prettyCoercion renders CoSym correctly", () => {
  const ax = coAxiom("a", tCon("Int"), tCon("Bool"));
  equal(prettyCoercion(coSym(ax)), "sym(axiom(a: Int ~ Bool))");
});

test("prettyCoercion renders CoTrans correctly", () => {
  const c1 = coAxiom("c1", tCon("Int"), tCon("String"));
  const c2 = coAxiom("c2", tCon("String"), tCon("Bool"));
  equal(
    prettyCoercion(coTrans(c1, c2)),
    "trans(axiom(c1: Int ~ String), axiom(c2: String ~ Bool))",
  );
});

test("prettyCoercion renders CoAxiom correctly", () => {
  const ax = coAxiom("IntBool", tCon("Int"), tCon("Bool"));
  equal(prettyCoercion(ax), "axiom(IntBool: Int ~ Bool)");
});

// ============================================================
// prettyCoreExpr
// ============================================================

test("prettyCoreExpr renders CoreLit with value and type", () => {
  const expr: CoreExpr = { tag: "CoreLit", value: 42, type: tCon("Int") };
  equal(prettyCoreExpr(expr), "42 : Int");
});

test("prettyCoreExpr renders CoreVar with name and type", () => {
  const expr: CoreExpr = { tag: "CoreVar", name: "x", type: tCon("Bool") };
  equal(prettyCoreExpr(expr), "x : Bool");
});

test("prettyCoreExpr renders CoreLam with lambda notation", () => {
  const body: CoreExpr = { tag: "CoreVar", name: "x", type: tCon("Int") };
  const expr: CoreExpr = {
    tag: "CoreLam",
    param: "x",
    paramType: tCon("Int"),
    body,
    type: tArrow(tCon("Int"), tCon("Int")),
  };
  const rendered = prettyCoreExpr(expr);
  match(rendered, /λx/);
  match(rendered, /Int/);
});

test("prettyCoreExpr renders CoreApp with @ separator", () => {
  const func: CoreExpr = {
    tag: "CoreVar",
    name: "f",
    type: tArrow(tCon("Int"), tCon("Bool")),
  };
  const arg: CoreExpr = { tag: "CoreLit", value: 1, type: tCon("Int") };
  const expr: CoreExpr = { tag: "CoreApp", func, arg, type: tCon("Bool") };
  match(prettyCoreExpr(expr), /f.*@.*1/);
});

test("prettyCoreExpr renders CoreConstruct with typeArgs and args", () => {
  const expr: CoreExpr = {
    tag: "CoreConstruct",
    constructor: "MkPair",
    typeArgs: [tCon("Int"), tCon("Bool")],
    args: [
      { tag: "CoreLit", value: 1, type: tCon("Int") },
      { tag: "CoreLit", value: true, type: tCon("Bool") },
    ],
    type: tCon("Pair", [tCon("Int"), tCon("Bool")]),
  };
  const rendered = prettyCoreExpr(expr);
  match(rendered, /MkPair/);
  match(rendered, /Int/);
  match(rendered, /Bool/);
});

test("prettyCoreExpr renders CoreCast with coercion evidence", () => {
  const inner: CoreExpr = { tag: "CoreLit", value: 0, type: tCon("Int") };
  const co = coAxiom("cast_ax", tCon("Int"), tCon("Bool"));
  const expr: CoreExpr = {
    tag: "CoreCast",
    expr: inner,
    coercion: co,
    type: tCon("Bool"),
  };
  const rendered = prettyCoreExpr(expr);
  match(rendered, /▷/);
  match(rendered, /axiom\(cast_ax/);
});

// ============================================================
// Remaining coercion forms — CoArrow / CoApp / CoForall / CoVar
// ============================================================

test("prettyCoercion renders CoArrow correctly", () => {
  const co: Coercion = {
    tag: "CoArrow",
    param: coRefl(tCon("Int")),
    result: coRefl(tCon("Bool")),
  };
  equal(prettyCoercion(co), "arrow(refl(Int), refl(Bool))");
});

test("prettyCoercion renders CoApp correctly", () => {
  const co: Coercion = {
    tag: "CoApp",
    constructor: coRefl(tCon("Maybe")),
    argument: coRefl(tCon("Int")),
  };
  equal(prettyCoercion(co), "app(refl(Maybe), refl(Int))");
});

test("prettyCoercion renders CoForall correctly", () => {
  const a = tVar("a");
  const co: Coercion = {
    tag: "CoForall",
    variable: a,
    kind: kStar,
    body: coRefl(tCon("Int")),
  };
  equal(prettyCoercion(co), "forall(a, refl(Int))");
});

test("prettyCoercion renders CoVar correctly", () => {
  const co: Coercion = {
    tag: "CoVar",
    name: "c0",
    lhs: tCon("Int"),
    rhs: tCon("Bool"),
  };
  equal(prettyCoercion(co), "co_c0");
});

// ============================================================
// prettyCoreExpr — remaining expression forms
// ============================================================

test("prettyCoreExpr renders CoreTyLam with Λ notation", () => {
  const body: CoreExpr = { tag: "CoreLit", value: 1, type: tCon("Int") };
  const a = tVar("a");
  const expr: CoreExpr = {
    tag: "CoreTyLam",
    typeVar: a,
    kind: kStar,
    body,
    type: { tag: "Forall" as any, variable: a, kind: kStar, body: tCon("Int") },
  };
  match(prettyCoreExpr(expr), /Λa/);
});

test("prettyCoreExpr renders CoreTyApp with @[] notation", () => {
  const inner: CoreExpr = { tag: "CoreVar", name: "f", type: tCon("Int") };
  const expr: CoreExpr = {
    tag: "CoreTyApp",
    expr: inner,
    typeArg: tCon("Bool"),
    type: tCon("Int"),
  };
  match(prettyCoreExpr(expr), /@\[Bool\]/);
});

test("prettyCoreExpr renders CoreLet with binding and body", () => {
  const value: CoreExpr = { tag: "CoreLit", value: 5, type: tCon("Int") };
  const body: CoreExpr = { tag: "CoreVar", name: "y", type: tCon("Int") };
  const expr: CoreExpr = {
    tag: "CoreLet",
    name: "y",
    type: tCon("Int"),
    value,
    body,
  };
  const rendered = prettyCoreExpr(expr);
  match(rendered, /let y/);
  match(rendered, /in/);
});

test("prettyCoreExpr renders CoreCase with alternatives and result type", () => {
  const scrutinee: CoreExpr = { tag: "CoreLit", value: true, type: tCon("Bool") };
  const trueBranch: CoreExpr = { tag: "CoreLit", value: 1, type: tCon("Int") };
  const falseBranch: CoreExpr = { tag: "CoreLit", value: 0, type: tCon("Int") };
  const expr: CoreExpr = {
    tag: "CoreCase",
    scrutinee,
    scrutineeType: tCon("Bool"),
    alternatives: [
      { constructor: "True", existentials: [], coercions: [], bindings: [], body: trueBranch },
      { constructor: "False", existentials: [], coercions: [], bindings: [], body: falseBranch },
    ],
    resultType: tCon("Int"),
  };
  const rendered = prettyCoreExpr(expr);
  match(rendered, /case/);
  match(rendered, /True/);
  match(rendered, /False/);
  match(rendered, /Int/);
});
