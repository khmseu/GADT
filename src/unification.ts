// ============================================================
// Unification Engine with GADT Equality Propagation
// ============================================================
// Stage  : 3a — Constraint solving
// Input  : TMeta, Type, TypeEquality from types
// Output : unify, zonk, applyRefinements, prettyType
// Deps   : types

import {
  Type,
  TypeTag,
  TypeEquality,
  TypeVarId,
  TMeta,
  TRigid,
  tMeta,
  freshId,
} from "./types";

export class UnificationError extends Error {
  constructor(
    public lhs: Type,
    public rhs: Type,
    message?: string,
  ) {
    super(message ?? `Cannot unify ${prettyType(lhs)} with ${prettyType(rhs)}`);
  }
}

export class OccursCheckError extends UnificationError {
  constructor(meta: TMeta, ty: Type) {
    super(
      meta,
      ty,
      `Occurs check: ${prettyType(meta)} appears in ${prettyType(ty)}`,
    );
  }
}

/** Chase metavariable indirections to find the current binding. */
export function zonk(ty: Type): Type {
  switch (ty.tag) {
    case TypeTag.Meta:
      if (ty.ref.contents !== null) {
        const resolved = zonk(ty.ref.contents);
        ty.ref.contents = resolved; // path compression
        return resolved;
      }
      return ty;
    case TypeTag.Constructor:
      return { ...ty, args: ty.args.map(zonk) };
    case TypeTag.Arrow:
      return { ...ty, param: zonk(ty.param), result: zonk(ty.result) };
    case TypeTag.Forall:
      return { ...ty, body: zonk(ty.body) };
    case TypeTag.Exists:
      return { ...ty, body: zonk(ty.body) };
    case TypeTag.App:
      return {
        ...ty,
        constructor: zonk(ty.constructor),
        argument: zonk(ty.argument),
      };
    case TypeTag.Refined:
      return {
        ...ty,
        base: zonk(ty.base),
        constraints: ty.constraints.map((c) => ({
          lhs: zonk(c.lhs),
          rhs: zonk(c.rhs),
        })),
      };
    default:
      return ty;
  }
}

/** Check if a metavariable occurs inside a type (occurs check). */
function occursIn(metaId: TypeVarId, ty: Type): boolean {
  const t = zonk(ty);
  switch (t.tag) {
    case TypeTag.Meta:
      return t.id === metaId;
    case TypeTag.Var:
    case TypeTag.Rigid:
      return false;
    case TypeTag.Constructor:
      return t.args.some((a) => occursIn(metaId, a));
    case TypeTag.Arrow:
      return occursIn(metaId, t.param) || occursIn(metaId, t.result);
    case TypeTag.Forall:
    case TypeTag.Exists:
      return occursIn(metaId, t.body);
    case TypeTag.App:
      return occursIn(metaId, t.constructor) || occursIn(metaId, t.argument);
    case TypeTag.Refined:
      return occursIn(metaId, t.base);
  }
}

/** Bind a metavariable, performing the occurs check. */
function bindMeta(meta: TMeta, ty: Type): void {
  if (occursIn(meta.id, ty)) {
    throw new OccursCheckError(meta, ty);
  }
  meta.ref.contents = ty;
}

/**
 * Core unification algorithm.
 * Handles metavariables, rigid variables, type constructors, arrows, etc.
 */
export function unify(lhs: Type, rhs: Type): void {
  const l = zonk(lhs);
  const r = zonk(rhs);

  if (l.tag === TypeTag.Meta && r.tag === TypeTag.Meta && l.id === r.id) return;

  if (l.tag === TypeTag.Meta) {
    bindMeta(l, r);
    return;
  }
  if (r.tag === TypeTag.Meta) {
    bindMeta(r, l);
    return;
  }

  if (l.tag === TypeTag.Var && r.tag === TypeTag.Var && l.id === r.id) return;
  if (l.tag === TypeTag.Rigid && r.tag === TypeTag.Rigid && l.id === r.id)
    return;

  if (l.tag === TypeTag.Constructor && r.tag === TypeTag.Constructor) {
    if (l.id !== r.id) throw new UnificationError(l, r);
    if (l.args.length !== r.args.length) throw new UnificationError(l, r);
    for (let i = 0; i < l.args.length; i++) {
      unify(l.args[i], r.args[i]);
    }
    return;
  }

  if (l.tag === TypeTag.Arrow && r.tag === TypeTag.Arrow) {
    unify(l.param, r.param);
    unify(l.result, r.result);
    return;
  }

  if (l.tag === TypeTag.App && r.tag === TypeTag.App) {
    unify(l.constructor, r.constructor);
    unify(l.argument, r.argument);
    return;
  }

  if (l.tag === TypeTag.Forall && r.tag === TypeTag.Forall) {
    // Alpha-equivalence: instantiate both with same fresh rigid var
    const rigid: TRigid = {
      tag: TypeTag.Rigid,
      id: freshId(),
      name: l.variable.name,
    };
    const lBody = substituteVar(l.body, l.variable.id, rigid);
    const rBody = substituteVar(r.body, r.variable.id, rigid);
    unify(lBody, rBody);
    return;
  }

  throw new UnificationError(l, r);
}

function substituteVar(ty: Type, varId: TypeVarId, replacement: Type): Type {
  switch (ty.tag) {
    case TypeTag.Var:
      return ty.id === varId ? replacement : ty;
    case TypeTag.Constructor:
      return {
        ...ty,
        args: ty.args.map((a) => substituteVar(a, varId, replacement)),
      };
    case TypeTag.Arrow:
      return {
        ...ty,
        param: substituteVar(ty.param, varId, replacement),
        result: substituteVar(ty.result, varId, replacement),
      };
    case TypeTag.Forall:
      if (ty.variable.id === varId) return ty; // shadowed
      return { ...ty, body: substituteVar(ty.body, varId, replacement) };
    case TypeTag.Exists:
      if (ty.variable.id === varId) return ty;
      return { ...ty, body: substituteVar(ty.body, varId, replacement) };
    case TypeTag.App:
      return {
        ...ty,
        constructor: substituteVar(ty.constructor, varId, replacement),
        argument: substituteVar(ty.argument, varId, replacement),
      };
    case TypeTag.Meta:
      if (ty.ref.contents) {
        return substituteVar(ty.ref.contents, varId, replacement);
      }
      return ty;
    case TypeTag.Refined:
      return {
        ...ty,
        base: substituteVar(ty.base, varId, replacement),
        constraints: ty.constraints.map((c) => ({
          lhs: substituteVar(c.lhs, varId, replacement),
          rhs: substituteVar(c.rhs, varId, replacement),
        })),
      };
    default:
      return ty;
  }
}

/**
 * Apply a set of type equalities (GADT refinements) to the unification state.
 * This is called when entering a GADT pattern match branch.
 */
export function applyRefinements(equalities: TypeEquality[]): void {
  for (const eq of equalities) {
    unify(eq.lhs, eq.rhs);
  }
}

/**
 * Attempt unification in a local scope. If it fails, roll back.
 * Used for speculative matching / overlap checking.
 */
export function tryUnify(lhs: Type, rhs: Type): boolean {
  const snapshot = captureMetaState([lhs, rhs]);
  try {
    unify(lhs, rhs);
    return true;
  } catch {
    restoreMetaState(snapshot);
    return false;
  }
}

type MetaSnapshot = Array<{ meta: TMeta; contents: Type | null }>;

function collectMetas(ty: Type, acc: TMeta[] = []): TMeta[] {
  const t = ty.tag === TypeTag.Meta && ty.ref.contents ? ty.ref.contents : ty;
  if (t.tag === TypeTag.Meta) {
    acc.push(t);
  }
  switch (t.tag) {
    case TypeTag.Constructor:
      t.args.forEach((a) => collectMetas(a, acc));
      break;
    case TypeTag.Arrow:
      collectMetas(t.param, acc);
      collectMetas(t.result, acc);
      break;
    case TypeTag.Forall:
    case TypeTag.Exists:
      collectMetas(t.body, acc);
      break;
    case TypeTag.App:
      collectMetas(t.constructor, acc);
      collectMetas(t.argument, acc);
      break;
  }
  return acc;
}

function captureMetaState(types: Type[]): MetaSnapshot {
  const metas = types.flatMap((t) => collectMetas(t));
  const seen = new Set<TypeVarId>();
  const snapshot: MetaSnapshot = [];
  for (const m of metas) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      snapshot.push({ meta: m, contents: m.ref.contents });
    }
  }
  return snapshot;
}

function restoreMetaState(snapshot: MetaSnapshot): void {
  for (const { meta, contents } of snapshot) {
    meta.ref.contents = contents;
  }
}

// ============================================================
// Pretty Printing
// ============================================================

export function prettyType(ty: Type): string {
  const t = zonk(ty);
  switch (t.tag) {
    case TypeTag.Var:
      return t.name;
    case TypeTag.Constructor:
      if (t.args.length === 0) return t.id;
      return `${t.id}<${t.args.map(prettyType).join(", ")}>`;
    case TypeTag.Arrow:
      return `(${prettyType(t.param)} -> ${prettyType(t.result)})`;
    case TypeTag.Forall:
      return `(∀${t.variable.name}. ${prettyType(t.body)})`;
    case TypeTag.Exists:
      return `(∃${t.variable.name}. ${prettyType(t.body)})`;
    case TypeTag.App:
      return `(${prettyType(t.constructor)} ${prettyType(t.argument)})`;
    case TypeTag.Rigid:
      return `#${t.name}`;
    case TypeTag.Meta:
      return `?${t.id}`;
    case TypeTag.Refined:
      const cs = t.constraints.map(
        (c) => `${prettyType(c.lhs)} ~ ${prettyType(c.rhs)}`,
      );
      return `${prettyType(t.base)} | ${cs.join(", ")}`;
  }
}
