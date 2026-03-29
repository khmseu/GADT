// ============================================================
// Abstract Syntax Tree — Expressions & Patterns
// ============================================================
// Stage  : 1 — Surface syntax
// Input  : —
// Output : Expr, Pattern, MatchBranch (surface-language nodes)
// Deps   : types, gadt

import { Type, TypeVarId, TVar, Kind } from "./types";
import { GADTConstructor } from "./gadt";

export type Expr =
  | ELiteral
  | EVar
  | ELambda
  | EApp
  | ELet
  | EAnnot
  | EConstruct
  | EMatch
  | EIf
  | ETyAbs      // type abstraction (Λa. e)
  | ETyApp;     // type application (e @τ)

export interface ELiteral {
  tag: "ELiteral";
  value: number | boolean | string;
  type?: Type;
}

export interface EVar {
  tag: "EVar";
  name: string;
  type?: Type;
}

export interface ELambda {
  tag: "ELambda";
  param: string;
  paramType?: Type;
  body: Expr;
  type?: Type;
}

export interface EApp {
  tag: "EApp";
  func: Expr;
  arg: Expr;
  type?: Type;
}

export interface ELet {
  tag: "ELet";
  name: string;
  annotation?: Type;
  value: Expr;
  body: Expr;
  type?: Type;
}

export interface EAnnot {
  tag: "EAnnot";
  expr: Expr;
  annotation: Type;
  type?: Type;
}

export interface EConstruct {
  tag: "EConstruct";
  constructor: string;
  typeArgs: Type[];
  args: Expr[];
  type?: Type;
}

/**
 * Pattern match expression (core of GADT elimination).
 *
 *   match scrutinee with
 *     | Pattern1 -> branch1
 *     | Pattern2 -> branch2
 *     ...
 *
 * The scrutinee must have a known GADT type so we can extract
 * type refinements from each branch.
 */
export interface EMatch {
  tag: "EMatch";
  scrutinee: Expr;
  branches: MatchBranch[];
  type?: Type;
}

export interface MatchBranch {
  pattern: Pattern;
  guard?: Expr;
  body: Expr;
  /** Filled in by the type checker: equalities available in this branch */
  refinements?: import("./types").TypeEquality[];
}

export interface ETyAbs {
  tag: "ETyAbs";
  typeVar: TVar;
  kind: Kind;
  body: Expr;
  type?: Type;
}

export interface ETyApp {
  tag: "ETyApp";
  expr: Expr;
  typeArg: Type;
  type?: Type;
}

export interface EIf {
  tag: "EIf";
  cond: Expr;
  then: Expr;
  else: Expr;
  type?: Type;
}

// ============================================================
// Patterns
// ============================================================

export type Pattern =
  | PWildcard
  | PVar
  | PLiteral
  | PConstructor;

export interface PWildcard {
  tag: "PWildcard";
}

export interface PVar {
  tag: "PVar";
  name: string;
  type?: Type;
}

export interface PLiteral {
  tag: "PLiteral";
  value: number | boolean | string;
}

/**
 * Constructor pattern — the key to GADT type refinement.
 *
 * When we match (PConstructor "IntLit" [x]) against (Expr a),
 * we learn that a ~ Int in the branch body.
 */
export interface PConstructor {
  tag: "PConstructor";
  constructor: string;
  /** Existential type variables introduced by this pattern */
  existentials: TVar[];
  /** Sub-patterns for constructor fields */
  subPatterns: Pattern[];
  /** Resolved constructor info (filled by type checker) */
  resolvedCtor?: GADTConstructor;
}
