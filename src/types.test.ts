// ============================================================
// Types Tests — Smart constructors and id generation behavior
// ============================================================
// Stage  : 8 — Automated regression tests
// Input  : types module constructors and counters
// Output : Assertion-based checks for type/kind constructor correctness
// Deps   : types, node:test

import { beforeEach, test } from "node:test";
import { deepStrictEqual, equal } from "node:assert/strict";

import {
  freshId,
  kArrow,
  kConstraint,
  KindTag,
  kStar,
  resetIdCounter,
  tApp,
  tArrow,
  tBool,
  tCon,
  tExists,
  tForall,
  tInt,
  tMeta,
  tRefined,
  tRigid,
  tString,
  tUnit,
  tVar,
  TypeTag,
} from "./types";

beforeEach(() => {
  resetIdCounter();
});

// ============================================================
// Counter and identifier behavior
// ============================================================

test("freshId increments monotonically", () => {
  equal(freshId(), 0);
  equal(freshId(), 1);
  equal(freshId(), 2);
});

test("resetIdCounter restarts freshId sequence", () => {
  equal(freshId(), 0);
  equal(freshId(), 1);
  resetIdCounter();
  equal(freshId(), 0);
});

// ============================================================
// Type smart constructors
// ============================================================

test("tVar uses provided id when supplied", () => {
  const v = tVar("a", 99);
  equal(v.tag, TypeTag.Var);
  equal(v.id, 99);
  equal(v.name, "a");
});

test("tVar allocates id when omitted", () => {
  const v = tVar("a");
  equal(v.id, 0);
});

test("tCon captures constructor id and arguments", () => {
  const maybeInt = tCon("Maybe", [tCon("Int")]);
  equal(maybeInt.tag, TypeTag.Constructor);
  equal(maybeInt.id, "Maybe");
  equal(maybeInt.args.length, 1);
  equal(maybeInt.args[0].tag, TypeTag.Constructor);
});

test("tArrow builds arrow type with param and result", () => {
  const a = tCon("Int");
  const b = tCon("Bool");
  const ty = tArrow(a, b);
  equal(ty.tag, TypeTag.Arrow);
  equal(ty.param, a);
  equal(ty.result, b);
});

test("tForall and tExists capture binder, kind, and body", () => {
  const a = tVar("a");
  const body = tCon("List", [a]);
  const f = tForall(a, kStar, body);
  const e = tExists(a, kStar, body);

  equal(f.tag, TypeTag.Forall);
  equal(f.variable, a);
  equal(f.kind, kStar);
  equal(f.body, body);

  equal(e.tag, TypeTag.Exists);
  equal(e.variable, a);
  equal(e.kind, kStar);
  equal(e.body, body);
});

test("tApp captures constructor and argument", () => {
  const ctor = tCon("F");
  const arg = tCon("Int");
  const app = tApp(ctor, arg);
  equal(app.tag, TypeTag.App);
  equal(app.constructor, ctor);
  equal(app.argument, arg);
});

test("tRigid and tMeta use provided ids when supplied", () => {
  const r = tRigid("sk", 7);
  const m = tMeta(8);

  equal(r.tag, TypeTag.Rigid);
  equal(r.id, 7);
  equal(r.name, "sk");

  equal(m.tag, TypeTag.Meta);
  equal(m.id, 8);
  equal(m.ref.contents, null);
});

test("tMeta allocates fresh ids when omitted", () => {
  const m1 = tMeta();
  const m2 = tMeta();
  equal(m1.id, 0);
  equal(m2.id, 1);
});

test("tRefined captures base and constraints", () => {
  const lhs = tCon("Int");
  const rhs = tCon("Bool");
  const refined = tRefined(tCon("Expr", [lhs]), [{ lhs, rhs }]);

  equal(refined.tag, TypeTag.Refined);
  equal(refined.base.tag, TypeTag.Constructor);
  equal(refined.constraints.length, 1);
  deepStrictEqual(refined.constraints[0], { lhs, rhs });
});

// ============================================================
// Kind constructors and pre-defined constants
// ============================================================

test("kArrow builds kind arrows", () => {
  const kk = kArrow(kStar, kConstraint);
  equal(kk.tag, KindTag.Arrow);
  if (kk.tag !== KindTag.Arrow) throw new Error("unreachable");
  equal(kk.from, kStar);
  equal(kk.to, kConstraint);
});

test("predefined base types are constructor constants", () => {
  equal(tInt.tag, TypeTag.Constructor);
  equal(tBool.tag, TypeTag.Constructor);
  equal(tString.tag, TypeTag.Constructor);
  equal(tUnit.tag, TypeTag.Constructor);
  equal(tInt.id, "Int");
  equal(tBool.id, "Bool");
  equal(tString.id, "String");
  equal(tUnit.id, "Unit");
});
