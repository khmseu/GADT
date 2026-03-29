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
import { prettyGADT, prettyKind } from "./prettyprint";
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
