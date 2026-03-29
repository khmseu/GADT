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
  tArrow,
  tCon,
  tForall,
  tMeta,
  tVar,
} from "./types";
import {
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
    }
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
