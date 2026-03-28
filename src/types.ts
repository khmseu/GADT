// ============================================================
// Core Type Representations
// ============================================================

/** Unique identifier for type variables */
export type TypeVarId = number;

/** Unique identifier for data constructors */
export type ConstructorId = string;

/** Unique identifier for type constructors */
export type TypeConstructorId = string;

/**
 * The universe of types in our language.
 * Types are indexed by their kind to ensure well-formedness.
 */
export enum TypeTag {
  Var = "Var",
  Constructor = "Constructor",
  Arrow = "Arrow",
  Forall = "Forall",
  Exists = "Exists",
  App = "App",
  Rigid = "Rigid",       // Skolem / rigid type variable
  Meta = "Meta",         // Unification metavariable
  Refined = "Refined",   // Type with refinement constraint
}

export type Type =
  | TVar
  | TConstructor
  | TArrow
  | TForall
  | TExists
  | TApp
  | TRigid
  | TMeta
  | TRefined;

export interface TVar {
  tag: TypeTag.Var;
  id: TypeVarId;
  name: string;
}

export interface TConstructor {
  tag: TypeTag.Constructor;
  id: TypeConstructorId;
  args: Type[];
}

export interface TArrow {
  tag: TypeTag.Arrow;
  param: Type;
  result: Type;
}

export interface TForall {
  tag: TypeTag.Forall;
  variable: TVar;
  kind: Kind;
  body: Type;
}

export interface TExists {
  tag: TypeTag.Exists;
  variable: TVar;
  kind: Kind;
  body: Type;
}

export interface TApp {
  tag: TypeTag.App;
  constructor: Type;
  argument: Type;
}

export interface TRigid {
  tag: TypeTag.Rigid;
  id: TypeVarId;
  name: string;
}

export interface TMeta {
  tag: TypeTag.Meta;
  id: TypeVarId;
  ref: { contents: Type | null }; // mutable cell for unification
}

export interface TRefined {
  tag: TypeTag.Refined;
  base: Type;
  constraints: TypeEquality[];
}

// ============================================================
// Kinds
// ============================================================

export enum KindTag {
  Star = "Star",       // *  — the kind of types
  Arrow = "KArrow",    // k1 -> k2
  Constraint = "Constraint",
}

export type Kind =
  | { tag: KindTag.Star }
  | { tag: KindTag.Arrow; from: Kind; to: Kind }
  | { tag: KindTag.Constraint };

// ============================================================
// Type Equality Witnesses (core of GADT refinement)
// ============================================================

export interface TypeEquality {
  lhs: Type;
  rhs: Type;
}

// ============================================================
// Smart Constructors
// ============================================================

let _nextId = 0;
export function freshId(): TypeVarId {
  return _nextId++;
}

export function resetIdCounter(): void {
  _nextId = 0;
}

export function tVar(name: string, id?: TypeVarId): TVar {
  return { tag: TypeTag.Var, id: id ?? freshId(), name };
}

export function tCon(id: TypeConstructorId, args: Type[] = []): TConstructor {
  return { tag: TypeTag.Constructor, id, args };
}

export function tArrow(param: Type, result: Type): TArrow {
  return { tag: TypeTag.Arrow, param, result };
}

export function tForall(variable: TVar, kind: Kind, body: Type): TForall {
  return { tag: TypeTag.Forall, variable, kind, body };
}

export function tExists(variable: TVar, kind: Kind, body: Type): TExists {
  return { tag: TypeTag.Exists, variable, kind, body };
}

export function tApp(constructor: Type, argument: Type): TApp {
  return { tag: TypeTag.App, constructor, argument };
}

export function tRigid(name: string, id?: TypeVarId): TRigid {
  return { tag: TypeTag.Rigid, id: id ?? freshId(), name };
}

export function tMeta(id?: TypeVarId): TMeta {
  return { tag: TypeTag.Meta, id: id ?? freshId(), ref: { contents: null } };
}

export function tRefined(base: Type, constraints: TypeEquality[]): TRefined {
  return { tag: TypeTag.Refined, base, constraints };
}

export const tInt = tCon("Int");
export const tBool = tCon("Bool");
export const tString = tCon("String");
export const tUnit = tCon("Unit");
export const kStar: Kind = { tag: KindTag.Star };
export const kConstraint: Kind = { tag: KindTag.Constraint };
export function kArrow(from: Kind, to: Kind): Kind {
  return { tag: KindTag.Arrow, from, to };
}
