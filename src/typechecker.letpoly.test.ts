// ============================================================
// Typechecker Let-Polymorphism Tests — Generalization coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : infer and typechecker environment construction
// Output : Assertion-based coverage for generalize() and instantiateScheme()
// Deps   : typechecker, types, unification, node:test

import { beforeEach, test } from "node:test";
import { equal } from "node:assert/strict";

import { emptyEnv, infer } from "./typechecker";
import { kStar, resetIdCounter, tArrow, tCon, tForall, tVar } from "./types";
import { prettyType } from "./unification";

beforeEach(() => {
  resetIdCounter();
});

// ============================================================
// Let generalization
// ============================================================

test("infer generalizes let-bound identity across Int and Bool uses", () => {
  const env = emptyEnv();
  const expr = {
    tag: "ELet" as const,
    name: "id",
    value: {
      tag: "ELambda" as const,
      param: "x",
      body: { tag: "EVar" as const, name: "x" },
    },
    body: {
      tag: "ELet" as const,
      name: "n",
      value: {
        tag: "EApp" as const,
        func: { tag: "EVar" as const, name: "id" },
        arg: { tag: "ELiteral" as const, value: 1 },
      },
      body: {
        tag: "EApp" as const,
        func: { tag: "EVar" as const, name: "id" },
        arg: { tag: "ELiteral" as const, value: true },
      },
    },
  };

  equal(prettyType(infer(env, expr)), "Bool");
});

test("infer instantiates pre-bound forall schemes on each variable lookup", () => {
  const a = tVar("a");
  const idScheme = tForall(a, kStar, tArrow(a, a));
  const env = { ...emptyEnv(), variables: new Map([["id", idScheme]]) };

  const intUse = infer(env, {
    tag: "EApp",
    func: { tag: "EVar", name: "id" },
    arg: { tag: "ELiteral", value: 7 },
  });
  const boolUse = infer(env, {
    tag: "EApp",
    func: { tag: "EVar", name: "id" },
    arg: { tag: "ELiteral", value: false },
  });

  equal(prettyType(intUse), "Int");
  equal(prettyType(boolUse), "Bool");
});

test("infer generalizes higher-order let bindings across distinct result types", () => {
  const env = emptyEnv();
  const expr = {
    tag: "ELet" as const,
    name: "const",
    value: {
      tag: "ELambda" as const,
      param: "x",
      body: {
        tag: "ELambda" as const,
        param: "y",
        body: { tag: "EVar" as const, name: "x" },
      },
    },
    body: {
      tag: "ELet" as const,
      name: "first",
      value: {
        tag: "EApp" as const,
        func: {
          tag: "EApp" as const,
          func: { tag: "EVar" as const, name: "const" },
          arg: { tag: "ELiteral" as const, value: 1 },
        },
        arg: { tag: "ELiteral" as const, value: true },
      },
      body: {
        tag: "EApp" as const,
        func: {
          tag: "EApp" as const,
          func: { tag: "EVar" as const, name: "const" },
          arg: { tag: "ELiteral" as const, value: false },
        },
        arg: { tag: "ELiteral" as const, value: 0 },
      },
    },
  };

  equal(prettyType(infer(env, expr)), "Bool");
});
