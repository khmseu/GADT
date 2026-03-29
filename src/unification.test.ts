// ============================================================
// Unification Tests — Solver-level regression coverage
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : types and unification solver primitives
// Output : Assertion-based coverage for unification edge cases and rollback semantics
// Deps   : types, unification, node:test

import { test } from "node:test";
import { equal, match, throws } from "node:assert/strict";

import {
  TypeTag,
  kStar,
  resetIdCounter,
  tApp,
  tArrow,
  tCon,
  tForall,
  tMeta,
  tRefined,
  tVar,
} from "./types";
import {
  applyRefinements,
  OccursCheckError,
  prettyType,
  tryUnify,
  unify,
  zonk,
} from "./unification";

/**
 * Build a canonical polymorphic identity type.
 *
 * @returns The type `forall a. a -> a`.
 */
function forallIdentityType() {
  const a = tVar("a");
  return tForall(a, kStar, tArrow(a, a));
}

test("tryUnify rolls back meta bindings on failure", () => {
  resetIdCounter();

  const lhs = tMeta();
  const rhs = tCon("Int");
  const incompatible = tCon("Bool");

  const committed = tryUnify(lhs, rhs);
  equal(committed, true);
  equal(prettyType(zonk(lhs)), "Int");

  const speculativeMeta = tMeta();
  const speculative = tryUnify(speculativeMeta, incompatible);
  equal(speculative, true);
  equal(prettyType(zonk(speculativeMeta)), "Bool");

  const rollbackMeta = tMeta();
  const rolledBack = tryUnify(rollbackMeta, tArrow(rollbackMeta, tCon("Int")));
  equal(rolledBack, false);
  equal(rollbackMeta.tag, TypeTag.Meta);
  equal(rollbackMeta.ref.contents, null);
});

test("unify enforces occurs-check for recursive bindings", () => {
  resetIdCounter();

  const meta = tMeta();
  const recursiveType = tArrow(meta, tCon("Int"));

  throws(
    () => unify(meta, recursiveType),
    (error) => {
      if (!(error instanceof OccursCheckError)) {
        return false;
      }
      match(error.message, /Occurs check/);
      return true;
    },
  );
});

test("unify treats alpha-equivalent forall types as equal", () => {
  resetIdCounter();

  const first = forallIdentityType();
  const b = tVar("b");
  const second = tForall(b, kStar, tArrow(b, b));

  unify(first, second);
  equal(first.tag, TypeTag.Forall);
  equal(second.tag, TypeTag.Forall);

  if (first.tag !== TypeTag.Forall || second.tag !== TypeTag.Forall) {
    throw new Error("Expected forall types after unification");
  }

  equal(first.body.tag, TypeTag.Arrow);
  equal(second.body.tag, TypeTag.Arrow);
});

test("applyRefinements propagates equalities into metavariables", () => {
  resetIdCounter();

  const meta = tMeta();
  const eqs = [{ lhs: meta, rhs: tCon("Int") }];

  applyRefinements(eqs);
  equal(prettyType(zonk(meta)), "Int");
});

test("zonk compresses meta indirections to terminal type", () => {
  resetIdCounter();

  const m1 = tMeta();
  const m2 = tMeta();

  unify(m1, m2);
  unify(m2, tCon("Bool"));

  const resolved = zonk(m1);
  equal(prettyType(resolved), "Bool");
  equal(m1.ref.contents?.tag, TypeTag.Constructor);
});

test("prettyType renders refined and application forms", () => {
  resetIdCounter();

  const lhs = tCon("Expr", [tCon("Int")]);
  const rhs = tCon("Expr", [tCon("Bool")]);

  const app = tApp(tCon("F"), tCon("Int"));
  const refined = tRefined(lhs, [{ lhs, rhs }]);

  equal(prettyType(app), "(F Int)");
  equal(prettyType(refined), "Expr<Int> | Expr<Int> ~ Expr<Bool>");
});
