// ============================================================
// Typechecker Inference Tests — infer() branch coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : infer, check, emptyEnv, registerGADT from typechecker
// Output : Assertion-based coverage for all infer() dispatch branches
// Deps   : typechecker, gadt, types, unification, node:test

import { beforeEach, test } from "node:test";
import { equal, throws } from "node:assert/strict";

import { GADTDeclaration, GADTTypeParam, gadtDeclaration } from "./gadt";
import { check, emptyEnv, infer, registerGADT, TypeEnv } from "./typechecker";
import { kStar, resetIdCounter, tCon, tForall, tVar } from "./types";
import { prettyType } from "./unification";

beforeEach(() => {
  resetIdCounter();
});

// ============================================================
// Helpers
// ============================================================

/**
 * Build a minimal Bool GADT for use in EIf and EConstruct tests.
 */
function buildBoolGADT(): GADTDeclaration {
  return gadtDeclaration(
    "Bool",
    [],
    [
      {
        name: "True",
        existentials: [],
        constraints: [],
        fields: [],
        returnType: tCon("Bool"),
        returnIndices: [],
      },
      {
        name: "False",
        existentials: [],
        constraints: [],
        fields: [],
        returnType: tCon("Bool"),
        returnIndices: [],
      },
    ],
  );
}

function makeEnv(): TypeEnv {
  return registerGADT(emptyEnv(), buildBoolGADT());
}

// ============================================================
// ELiteral
// ============================================================

test("infer ELiteral number returns Int", () => {
  equal(prettyType(infer(makeEnv(), { tag: "ELiteral", value: 0 })), "Int");
});

test("infer ELiteral boolean returns Bool", () => {
  equal(
    prettyType(infer(makeEnv(), { tag: "ELiteral", value: false })),
    "Bool",
  );
});

test("infer ELiteral string returns String", () => {
  equal(
    prettyType(infer(makeEnv(), { tag: "ELiteral", value: "hi" })),
    "String",
  );
});

// ============================================================
// EVar
// ============================================================

test("infer EVar returns type from environment", () => {
  const env = { ...makeEnv(), variables: new Map([["x", tCon("Int")]]) };
  equal(prettyType(infer(env, { tag: "EVar", name: "x" })), "Int");
});

test("infer EVar throws on unbound name", () => {
  throws(
    () => infer(makeEnv(), { tag: "EVar", name: "missing" }),
    /Unbound variable: missing/,
  );
});

// ============================================================
// ELambda
// ============================================================

test("infer ELambda with annotated param returns arrow type", () => {
  // λx:Int. x  →  Int -> Int
  const result = infer(makeEnv(), {
    tag: "ELambda",
    param: "x",
    paramType: tCon("Int"),
    body: { tag: "EVar", name: "x" },
  });
  equal(
    prettyType(result),
    prettyType({
      tag: "Arrow",
      param: tCon("Int"),
      result: tCon("Int"),
    } as any),
  );
});

// ============================================================
// EApp
// ============================================================

test("infer EApp returns result type of applied function", () => {
  // (λx:Int. x) 5  →  Int
  const env = makeEnv();
  const result = infer(env, {
    tag: "EApp",
    func: {
      tag: "ELambda",
      param: "x",
      paramType: tCon("Int"),
      body: { tag: "EVar", name: "x" },
    },
    arg: { tag: "ELiteral", value: 5 },
  });
  equal(prettyType(result), "Int");
});

// ============================================================
// ELet
// ============================================================

test("infer ELet makes bound name available in body", () => {
  // let y = 3 in y  →  Int
  const result = infer(makeEnv(), {
    tag: "ELet",
    name: "y",
    value: { tag: "ELiteral", value: 3 },
    body: { tag: "EVar", name: "y" },
  });
  equal(prettyType(result), "Int");
});

test("infer ELet with annotation checks value against annotation", () => {
  // let y : Int = 3 in y  →  Int
  const result = infer(makeEnv(), {
    tag: "ELet",
    name: "y",
    annotation: tCon("Int"),
    value: { tag: "ELiteral", value: 3 },
    body: { tag: "EVar", name: "y" },
  });
  equal(prettyType(result), "Int");
});

// ============================================================
// EAnnot
// ============================================================

test("infer EAnnot returns the annotation type", () => {
  // (42 : Int)  →  Int
  const result = infer(makeEnv(), {
    tag: "EAnnot",
    expr: { tag: "ELiteral", value: 42 },
    annotation: tCon("Int"),
  });
  equal(prettyType(result), "Int");
});

// ============================================================
// EIf
// ============================================================

test("infer EIf unifies branches and returns their type", () => {
  // if true then 1 else 2  →  Int
  const result = infer(makeEnv(), {
    tag: "EIf",
    cond: { tag: "ELiteral", value: true },
    then: { tag: "ELiteral", value: 1 },
    else: { tag: "ELiteral", value: 2 },
  });
  equal(prettyType(result), "Int");
});

test("infer EIf rejects non-Bool condition", () => {
  throws(
    () =>
      infer(makeEnv(), {
        tag: "EIf",
        cond: { tag: "ELiteral", value: 0 },
        then: { tag: "ELiteral", value: 1 },
        else: { tag: "ELiteral", value: 2 },
      }),
    /Cannot unify|Int|Bool/,
  );
});

// ============================================================
// ETyAbs / ETyApp
// ============================================================

test("infer ETyAbs produces a forall type", () => {
  // Λa. 42  →  ∀a. Int
  const a = tVar("a");
  const result = infer(makeEnv(), {
    tag: "ETyAbs",
    typeVar: a,
    kind: kStar,
    body: { tag: "ELiteral", value: 42 },
  });
  equal(result.tag, "Forall");
});

test("infer ETyApp instantiates forall with supplied type argument", () => {
  // (Λa. 42) @Int  →  Int
  const a = tVar("a");
  const result = infer(makeEnv(), {
    tag: "ETyApp",
    expr: {
      tag: "ETyAbs",
      typeVar: a,
      kind: kStar,
      body: { tag: "ELiteral", value: 42 },
    },
    typeArg: tCon("Int"),
  });
  equal(prettyType(result), "Int");
});

test("infer ETyApp on non-forall type throws descriptive error", () => {
  throws(
    () =>
      infer(makeEnv(), {
        tag: "ETyApp",
        expr: { tag: "ELiteral", value: 1 },
        typeArg: tCon("Int"),
      }),
    /Expected forall/,
  );
});

// ============================================================
// check()
// ============================================================

test("check passes when inferred type unifies with expected", () => {
  // no throw: 42 : Int
  check(makeEnv(), { tag: "ELiteral", value: 42 }, tCon("Int"));
});

test("check throws when inferred type conflicts with expected", () => {
  throws(
    () => check(makeEnv(), { tag: "ELiteral", value: 42 }, tCon("Bool")),
    /Cannot unify/,
  );
});
