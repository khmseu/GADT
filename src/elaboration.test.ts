// ============================================================
// Elaboration Tests — Surface AST → Core IR translation coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : elaborate and surface AST constructors, TypeEnv helpers
// Output : Assertion-based checks for literal, variable, lambda, app,
//          let, if, and constructor elaboration
// Deps   : elaboration, ast, types, typechecker, unification, node:test

import { beforeEach, test } from "node:test";
import { equal, match, throws } from "node:assert/strict";

import { elaborate } from "./elaboration";
import { GADTDeclaration, GADTTypeParam, gadtDeclaration } from "./gadt";
import { coreExprType } from "./ir";
import { emptyEnv, registerGADT, TypeEnv } from "./typechecker";
import { kStar, resetIdCounter, tArrow, tCon, tVar } from "./types";
import { prettyType } from "./unification";

beforeEach(() => {
  resetIdCounter();
});

// ============================================================
// Helpers
// ============================================================

/**
 * Build a minimal Bool GADT so EIf elaboration has True/False constructors
 * and EConstruct tests have at least one registered constructor.
 */
function buildBoolGADT(): GADTDeclaration {
  return gadtDeclaration("Bool", [], [
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
  ]);
}

/**
 * Build a minimal Pair GADT for constructor elaboration tests.
 * Pair a b has one constructor: MkPair(a, b) : Pair a b.
 */
function buildPairGADT(): GADTDeclaration {
  const a = tVar("a");
  const b = tVar("b");
  const paramA: GADTTypeParam = { variable: a, kind: kStar };
  const paramB: GADTTypeParam = { variable: b, kind: kStar };

  return gadtDeclaration("Pair", [paramA, paramB], [
    {
      name: "MkPair",
      existentials: [],
      constraints: [],
      fields: [a, b],
      returnType: tCon("Pair", [a, b]),
      returnIndices: [a, b],
    },
  ]);
}

/**
 * Build a minimal Expr GADT to exercise constructor-match elaboration.
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
  ]);
}

/**
 * Create a test environment with Bool and Pair GADTs registered.
 */
function makeEnv(): TypeEnv {
  let env = emptyEnv();
  env = registerGADT(env, buildBoolGADT());
  env = registerGADT(env, buildPairGADT());
  return env;
}

/**
 * Create a test environment with the Expr GADT registered.
 */
function makeExprEnv(): TypeEnv {
  return registerGADT(emptyEnv(), buildExprGADT());
}

// ============================================================
// Literal elaboration
// ============================================================

test("elaborate integer literal produces CoreLit with Int type", () => {
  const env = makeEnv();
  const result = elaborate(env, { tag: "ELiteral", value: 42 });

  equal(result.tag, "CoreLit");
  if (result.tag !== "CoreLit") throw new Error("unreachable");
  equal(result.value, 42);
  equal(prettyType(result.type), "Int");
});

test("elaborate boolean literal produces CoreLit with Bool type", () => {
  const env = makeEnv();
  const result = elaborate(env, { tag: "ELiteral", value: true });

  equal(result.tag, "CoreLit");
  if (result.tag !== "CoreLit") throw new Error("unreachable");
  equal(result.value, true);
  equal(prettyType(result.type), "Bool");
});

test("elaborate string literal produces CoreLit with String type", () => {
  const env = makeEnv();
  const result = elaborate(env, { tag: "ELiteral", value: "hello" });

  equal(result.tag, "CoreLit");
  if (result.tag !== "CoreLit") throw new Error("unreachable");
  equal(result.value, "hello");
  equal(prettyType(result.type), "String");
});

// ============================================================
// Variable elaboration
// ============================================================

test("elaborate bound variable produces CoreVar with correct type", () => {
  let env = makeEnv();
  env = { ...env, variables: new Map([["x", tCon("Int")]]) };

  const result = elaborate(env, { tag: "EVar", name: "x" });

  equal(result.tag, "CoreVar");
  if (result.tag !== "CoreVar") throw new Error("unreachable");
  equal(result.name, "x");
  equal(prettyType(coreExprType(result)), "Int");
});

test("elaborate unbound variable throws with variable name in message", () => {
  const env = makeEnv();
  throws(
    () => elaborate(env, { tag: "EVar", name: "missing" }),
    /Unbound: missing/,
  );
});

// ============================================================
// Lambda elaboration
// ============================================================

test("elaborate lambda produces CoreLam with arrow type", () => {
  const env = makeEnv();
  const result = elaborate(env, {
    tag: "ELambda",
    param: "n",
    paramType: tCon("Int"),
    body: { tag: "EVar", name: "n" },
  });

  equal(result.tag, "CoreLam");
  if (result.tag !== "CoreLam") throw new Error("unreachable");
  equal(result.param, "n");
  equal(prettyType(result.type), prettyType(tArrow(tCon("Int"), tCon("Int"))));
});

// ============================================================
// Application elaboration
// ============================================================

test("elaborate application unifies function and argument types", () => {
  const env = makeEnv();
  // Build (λx:Int. x) 7
  const func = {
    tag: "ELambda",
    param: "x",
    paramType: tCon("Int"),
    body: { tag: "EVar", name: "x" },
  } as const;
  const result = elaborate(env, {
    tag: "EApp",
    func,
    arg: { tag: "ELiteral", value: 7 },
  });

  equal(result.tag, "CoreApp");
  equal(prettyType(coreExprType(result)), "Int");
});

// ============================================================
// Let elaboration
// ============================================================

test("elaborate let produces CoreLet with correct binding name and body type", () => {
  const env = makeEnv();
  // let y = 5 in y
  const result = elaborate(env, {
    tag: "ELet",
    name: "y",
    value: { tag: "ELiteral", value: 5 },
    body: { tag: "EVar", name: "y" },
  });

  equal(result.tag, "CoreLet");
  if (result.tag !== "CoreLet") throw new Error("unreachable");
  equal(result.name, "y");
  equal(prettyType(coreExprType(result)), "Int");
});

test("elaborate annotation discards wrapper and elaborates inner expression", () => {
  const env = makeEnv();
  const result = elaborate(env, {
    tag: "EAnnot",
    expr: { tag: "ELiteral", value: 5 },
    annotation: tCon("Int"),
  });

  equal(result.tag, "CoreLit");
  if (result.tag !== "CoreLit") throw new Error("unreachable");
  equal(result.value, 5);
  equal(prettyType(result.type), "Int");
});

// ============================================================
// If elaboration
// ============================================================

test("elaborate if produces CoreCase with True and False alternatives", () => {
  const env = makeEnv();
  // if true then 1 else 2
  const result = elaborate(env, {
    tag: "EIf",
    cond: { tag: "ELiteral", value: true },
    then: { tag: "ELiteral", value: 1 },
    else: { tag: "ELiteral", value: 2 },
  });

  equal(result.tag, "CoreCase");
  if (result.tag !== "CoreCase") throw new Error("unreachable");
  equal(result.alternatives.length, 2);
  equal(result.alternatives[0].constructor, "True");
  equal(result.alternatives[1].constructor, "False");
  equal(prettyType(result.resultType), "Int");
});

// ============================================================
// Constructor elaboration
// ============================================================

test("elaborate EConstruct produces CoreConstruct with GADT return type", () => {
  const env = makeEnv();
  // MkPair(1, true)
  const result = elaborate(env, {
    tag: "EConstruct",
    constructor: "MkPair",
    typeArgs: [tCon("Int"), tCon("Bool")],
    args: [
      { tag: "ELiteral", value: 1 },
      { tag: "ELiteral", value: true },
    ],
  });

  equal(result.tag, "CoreConstruct");
  if (result.tag !== "CoreConstruct") throw new Error("unreachable");
  equal(result.constructor, "MkPair");
  equal(result.args.length, 2);
  match(prettyType(coreExprType(result)), /Pair/);
});

// ============================================================
// Type abstraction and application elaboration
// ============================================================

test("elaborate ETyAbs produces CoreTyLam with forall type", () => {
  const env = makeEnv();
  const a = tVar("a");
  const result = elaborate(env, {
    tag: "ETyAbs",
    typeVar: a,
    kind: kStar,
    body: { tag: "ELiteral", value: 42 },
  });

  equal(result.tag, "CoreTyLam");
  if (result.tag !== "CoreTyLam") throw new Error("unreachable");
  equal(result.typeVar.name, "a");
  equal(prettyType(result.type), "(∀a. Int)");
});

test("elaborate ETyApp instantiates the body type", () => {
  const env = makeEnv();
  const a = tVar("a");
  const result = elaborate(env, {
    tag: "ETyApp",
    expr: {
      tag: "ETyAbs",
      typeVar: a,
      kind: kStar,
      body: { tag: "ELiteral", value: 42 },
    },
    typeArg: tCon("Int"),
  });

  equal(result.tag, "CoreTyApp");
  if (result.tag !== "CoreTyApp") throw new Error("unreachable");
  equal(prettyType(result.type), "Int");
});

// ============================================================
// Match elaboration
// ============================================================

test("elaborate variable-pattern match binds scrutinee in CoreCase alternative", () => {
  const env = makeEnv();
  const result = elaborate(env, {
    tag: "EMatch",
    scrutinee: { tag: "ELiteral", value: 7 },
    branches: [
      {
        pattern: { tag: "PVar", name: "x" },
        body: { tag: "EVar", name: "x" },
      },
    ],
  });

  equal(result.tag, "CoreCase");
  if (result.tag !== "CoreCase") throw new Error("unreachable");
  equal(result.alternatives[0].constructor, "@var(x)");
  equal(result.alternatives[0].bindings.length, 1);
  equal(result.alternatives[0].bindings[0].name, "x");
  equal(prettyType(result.alternatives[0].bindings[0].type), "Int");
});

test("elaborate constructor-pattern match emits coercions and field bindings", () => {
  const env = makeExprEnv();
  const result = elaborate(env, {
    tag: "EMatch",
    scrutinee: {
      tag: "EConstruct",
      constructor: "IntLit",
      typeArgs: [],
      args: [{ tag: "ELiteral", value: 1 }],
    },
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
  });

  equal(result.tag, "CoreCase");
  if (result.tag !== "CoreCase") throw new Error("unreachable");
  equal(result.alternatives[0].constructor, "IntLit");
  equal(result.alternatives[0].bindings.length, 1);
  equal(result.alternatives[0].bindings[0].name, "n");
  equal(prettyType(result.alternatives[0].bindings[0].type), "Int");
  equal(result.alternatives[0].coercions.length, 2);
});
