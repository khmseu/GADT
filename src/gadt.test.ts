// ============================================================
// GADT Helper Tests — Declaration and substitution coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : gadt helper APIs and type fixtures
// Output : Assertion-based coverage for declaration wiring and refinement helpers
// Deps   : gadt, types, unification, node:test

import { test } from "node:test";
import { deepStrictEqual, equal } from "node:assert/strict";

import {
  applySubstitution,
  extractRefinements,
  GADTConstructor,
  GADTTypeParam,
  gadtDeclaration,
} from "./gadt";
import {
  kStar,
  tArrow,
  tCon,
  tMeta,
  tVar,
  TypeEquality,
} from "./types";
import { prettyType } from "./unification";

/**
 * Build a minimal constructor fixture for refinement extraction checks.
 *
 * @returns Constructor metadata with one declared constraint and one return index.
 */
function buildIntLitCtor(): GADTConstructor {
  const a = tVar("a");
  const paramA: GADTTypeParam = { variable: a, kind: kStar };

  return {
    name: "IntLit",
    universals: [paramA],
    existentials: [],
    constraints: [{ lhs: a, rhs: tCon("Int") }],
    fields: [tCon("Int")],
    returnType: tCon("Expr", [tCon("Int")]),
    returnIndices: [tCon("Int")],
  };
}

test("gadtDeclaration propagates parent universals to every constructor", () => {
  const a = tVar("a");
  const paramA: GADTTypeParam = { variable: a, kind: kStar };

  const decl = gadtDeclaration("Expr", [paramA], [
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
  ]);

  equal(decl.constructors.length, 2);
  deepStrictEqual(
    decl.constructors.map((ctor) => ctor.universals.map((u) => u.variable.name)),
    [["a"], ["a"]]
  );
});

test("extractRefinements returns declared constraints plus index equalities", () => {
  const ctor = buildIntLitCtor();
  const scrutineeIndices = [tCon("Int")];

  const refinements = extractRefinements(scrutineeIndices, ctor);

  const rendered: TypeEquality[] = refinements.map((eq) => ({
    lhs: eq.lhs,
    rhs: eq.rhs,
  }));
  equal(rendered.length, 2);
  equal(prettyType(rendered[0].lhs), "a");
  equal(prettyType(rendered[0].rhs), "Int");
  equal(prettyType(rendered[1].lhs), "Int");
  equal(prettyType(rendered[1].rhs), "Int");
});

test("applySubstitution rewrites nested constructor and arrow members", () => {
  const a = tVar("a");
  const b = tVar("b");
  const original = tArrow(tCon("Expr", [a]), tCon("Pair", [a, b]));
  const subst = new Map([
    [a.id, tCon("Int")],
    [b.id, tCon("Bool")],
  ]);

  const substituted = applySubstitution(original, subst);

  equal(prettyType(substituted), "(Expr<Int> -> Pair<Int, Bool>)");
});

test("applySubstitution follows solved metavariables", () => {
  const meta = tMeta();
  meta.ref.contents = tCon("Int");

  const substituted = applySubstitution(meta, new Map());

  equal(prettyType(substituted), "Int");
});
