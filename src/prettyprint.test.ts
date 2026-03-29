// ============================================================
// Pretty Print Tests — Rendering regression coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : prettyprint module with GADT/type fixtures
// Output : Assertion-based checks for kind and GADT formatting stability
// Deps   : gadt, prettyprint, types, node:test

import { test } from "node:test";
import { equal, match } from "node:assert/strict";

import { GADTDeclaration, GADTTypeParam, gadtDeclaration } from "./gadt";
import { coAxiom } from "./ir";
import { prettyCoreExpr, prettyGADT, prettyKind } from "./prettyprint";
import { kArrow, kStar, tCon, tVar } from "./types";

/**
 * Build a representative Expr GADT for formatting assertions.
 *
 * @returns A declaration containing constraints and field arrows.
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
 * Build a constructor with existentials to exercise prettyCtor formatting.
 *
 * @returns A declaration containing existential quantification.
 */
function buildBoxGADT(): GADTDeclaration {
  const a = tVar("a");
  const b = tVar("b");

  return gadtDeclaration("Box", [{ variable: a, kind: kStar }], [
    {
      name: "Pack",
      existentials: [{ variable: b, kind: kStar }],
      constraints: [],
      fields: [b],
      returnType: tCon("Box", [a]),
      returnIndices: [a],
    },
  ]);
}

test("prettyKind renders nested kind arrows", () => {
  const kind = kArrow(kStar, kArrow(kStar, kStar));

  equal(prettyKind(kind), "(* -> (* -> *))");
});

test("prettyGADT prints constructor constraints and field arrows", () => {
  const rendered = prettyGADT(buildExprGADT());

  match(rendered, /^data Expr \(a : \*\) where/m);
  match(rendered, /IntLit : \(a ~ Int\) => Int -> Expr<Int>/);
  match(rendered, /Add : \(a ~ Int\) => Expr<Int> -> Expr<Int> -> Expr<Int>/);
});

test("prettyGADT prints existential quantifiers on constructors", () => {
  const rendered = prettyGADT(buildBoxGADT());

  match(rendered, /^data Box \(a : \*\) where/m);
  match(rendered, /Pack : ∀b\. b -> Box<a>/);
});

test("prettyCoreExpr prints CoreCase alternatives with existentials, coercions, and bindings", () => {
  const a = tVar("a");
  const rendered = prettyCoreExpr({
    tag: "CoreCase",
    scrutinee: { tag: "CoreVar", name: "expr", type: tCon("Expr", [tCon("Int")]) },
    scrutineeType: tCon("Expr", [tCon("Int")]),
    alternatives: [
      {
        constructor: "Pack",
        existentials: [{ var: a, kind: kStar }],
        coercions: [coAxiom("pack_eq", tCon("Expr", [tCon("Int")]), tCon("Expr", [tCon("Int")]))],
        bindings: [{ name: "payload", type: tCon("Int") }],
        body: { tag: "CoreVar", name: "payload", type: tCon("Int") },
      },
    ],
    resultType: tCon("Int"),
  });

  match(rendered, /case expr : Expr<Int> : Expr<Int> of/);
  match(rendered, /\| Pack ∃a\. \[axiom\(pack_eq: Expr<Int> ~ Expr<Int>\)\]\(payload:Int\) ->/);
  match(rendered, /payload : Int/);
  match(rendered, /: Int$/m);
});
