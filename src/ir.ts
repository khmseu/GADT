// ============================================================
// Intermediate Representation: Core Language with GADTs
// ============================================================
// Stage  : 4a — Core IR definitions
// Input  : Type, Kind from types; GADTConstructor from gadt
// Output : CoreExpr, CoreAlt, Coercion, coercion smart-constructors
// Deps   : types, gadt

import { Type, TypeVarId, TVar, Kind } from "./types";
import { GADTConstructor } from "./gadt";

/**
 * System FC-style core language with explicit type evidence.
 * This is the target of elaboration from the surface language.
 *
 * Key features:
 *  - Explicit type abstractions and applications
 *  - Coercions (type equality evidence) for GADT refinement
 *  - Case expressions carry type refinement info
 */

export type CoreExpr =
  | CoreLit
  | CoreVar
  | CoreLam
  | CoreApp
  | CoreTyLam
  | CoreTyApp
  | CoreLet
  | CoreCase
  | CoreConstruct
  | CoreCast; // Apply a coercion (type equality evidence)

export interface CoreLit {
  tag: "CoreLit";
  value: number | boolean | string;
  type: Type;
}

export interface CoreVar {
  tag: "CoreVar";
  name: string;
  type: Type;
}

export interface CoreLam {
  tag: "CoreLam";
  param: string;
  paramType: Type;
  body: CoreExpr;
  type: Type;
}

export interface CoreApp {
  tag: "CoreApp";
  func: CoreExpr;
  arg: CoreExpr;
  type: Type;
}

export interface CoreTyLam {
  tag: "CoreTyLam";
  typeVar: TVar;
  kind: Kind;
  body: CoreExpr;
  type: Type;
}

export interface CoreTyApp {
  tag: "CoreTyApp";
  expr: CoreExpr;
  typeArg: Type;
  type: Type;
}

export interface CoreLet {
  tag: "CoreLet";
  name: string;
  type: Type;
  value: CoreExpr;
  body: CoreExpr;
}

/**
 * Core case expression with GADT refinement evidence.
 *
 * Each alternative carries:
 *  - The constructor being matched
 *  - Existential type variables it introduces
 *  - Type equalities (coercions) available in the branch
 *  - Field bindings with their types
 */
export interface CoreCase {
  tag: "CoreCase";
  scrutinee: CoreExpr;
  scrutineeType: Type;
  alternatives: CoreAlt[];
  resultType: Type;
}

export interface CoreAlt {
  constructor: string;
  existentials: Array<{ var: TVar; kind: Kind }>;
  coercions: Coercion[];
  bindings: Array<{ name: string; type: Type }>;
  body: CoreExpr;
}

export interface CoreConstruct {
  tag: "CoreConstruct";
  constructor: string;
  typeArgs: Type[];
  args: CoreExpr[];
  type: Type;
}

/**
 * Cast expression: rewrite the type of an expression using
 * a coercion (evidence of type equality).
 *
 * e ▷ (τ₁ ~ τ₂)  :  τ₂    (given e : τ₁)
 */
export interface CoreCast {
  tag: "CoreCast";
  expr: CoreExpr;
  coercion: Coercion;
  type: Type;
}

// ============================================================
// Coercions — Evidence of Type Equality
// ============================================================

/**
 * Coercions form a language of type equality proofs.
 * Inspired by System FC (GHC's intermediate language).
 */
export type Coercion =
  | CoRefl // τ ~ τ
  | CoSym // if c : τ₁ ~ τ₂, then sym c : τ₂ ~ τ₁
  | CoTrans // if c₁ : τ₁ ~ τ₂, c₂ : τ₂ ~ τ₃, then trans c₁ c₂ : τ₁ ~ τ₃
  | CoArrow // if c₁ : σ₁ ~ σ₂, c₂ : τ₁ ~ τ₂, then arrow c₁ c₂ : (σ₁→τ₁) ~ (σ₂→τ₂)
  | CoApp // congruence for type application
  | CoForall // under a binder
  | CoAxiom // from GADT constructor (given by pattern matching)
  | CoVar; // coercion variable (from pattern match branch)

export interface CoRefl {
  tag: "CoRefl";
  type: Type;
}

export interface CoSym {
  tag: "CoSym";
  coercion: Coercion;
}

export interface CoTrans {
  tag: "CoTrans";
  first: Coercion;
  second: Coercion;
}

export interface CoArrow {
  tag: "CoArrow";
  param: Coercion;
  result: Coercion;
}

export interface CoApp {
  tag: "CoApp";
  constructor: Coercion;
  argument: Coercion;
}

export interface CoForall {
  tag: "CoForall";
  variable: TVar;
  kind: Kind;
  body: Coercion;
}

export interface CoAxiom {
  tag: "CoAxiom";
  name: string;
  lhs: Type;
  rhs: Type;
}

export interface CoVar {
  tag: "CoVar";
  name: string;
  lhs: Type;
  rhs: Type;
}

// Smart constructors for coercions
export function coRefl(type: Type): CoRefl {
  return { tag: "CoRefl", type };
}

export function coSym(c: Coercion): Coercion {
  if (c.tag === "CoRefl") return c;
  if (c.tag === "CoSym") return c.coercion;
  return { tag: "CoSym", coercion: c };
}

export function coTrans(c1: Coercion, c2: Coercion): Coercion {
  if (c1.tag === "CoRefl") return c2;
  if (c2.tag === "CoRefl") return c1;
  return { tag: "CoTrans", first: c1, second: c2 };
}

export function coAxiom(name: string, lhs: Type, rhs: Type): CoAxiom {
  return { tag: "CoAxiom", name, lhs, rhs };
}

// ============================================================
// Core Expression Utilities
// ============================================================

export function coreExprType(expr: CoreExpr): Type {
  switch (expr.tag) {
    case "CoreLit":
      return expr.type;
    case "CoreVar":
      return expr.type;
    case "CoreLam":
      return expr.type;
    case "CoreApp":
      return expr.type;
    case "CoreTyLam":
      return expr.type;
    case "CoreTyApp":
      return expr.type;
    case "CoreLet":
      return coreExprType(expr.body);
    case "CoreCase":
      return expr.resultType;
    case "CoreConstruct":
      return expr.type;
    case "CoreCast":
      return expr.type;
  }
}
