// ============================================================
// GADT Definitions — Declarations & Constructors
// ============================================================
// Stage  : 2 — GADT declaration model
// Input  : Type, Kind, TypeEquality from types
// Output : GADTDeclaration, GADTConstructor, substitution helpers
// Deps   : types

import {
  Type, Kind, TypeEquality, TypeVarId, TVar,
  TypeTag, KindTag, tVar, tCon, kStar,
} from "./types";

/**
 * A GADT declaration, e.g.:
 *
 *   data Expr (a : *) where
 *     IntLit  : Int  -> Expr Int
 *     BoolLit : Bool -> Expr Bool
 *     Add     : Expr Int -> Expr Int -> Expr Int
 *     If      : Expr Bool -> Expr a -> Expr a -> Expr a
 *     Eq      : Expr Int -> Expr Int -> Expr Bool
 */
export interface GADTDeclaration {
  name: string;                          // e.g. "Expr"
  typeParams: GADTTypeParam[];           // universally quantified params
  kind: Kind;                            // resulting kind
  constructors: GADTConstructor[];       // data constructors
}

export interface GADTTypeParam {
  variable: TVar;
  kind: Kind;
}

/**
 * A single GADT constructor with its full signature.
 *
 * Each constructor may:
 *  - Introduce existential type variables
 *  - Impose type equality constraints on the return type indices
 *  - Have a list of field types
 */
export interface GADTConstructor {
  name: string;
  universals: GADTTypeParam[];           // from the parent GADT
  existentials: GADTTypeParam[];         // ∃-bound type vars introduced by this ctor
  constraints: TypeEquality[];           // equalities that hold when this ctor is matched
  fields: Type[];                        // argument types
  returnType: Type;                      // must be an application of the parent GADT
  returnIndices: Type[];                 // the type indices in the return type
}

/**
 * Build a GADT declaration from a high-level spec.
 */
export function gadtDeclaration(
  name: string,
  typeParams: GADTTypeParam[],
  constructors: Omit<GADTConstructor, "universals">[]
): GADTDeclaration {
  const kind = typeParams.reduceRight<Kind>(
    (acc, p) => ({ tag: KindTag.Arrow, from: p.kind, to: acc }),
    kStar
  );
  return {
    name,
    typeParams,
    kind,
    constructors: constructors.map((c) => ({
      ...c,
      universals: typeParams,
    })),
  };
}

/**
 * Extract the type equalities that arise when pattern-matching a GADT
 * constructor against a known scrutinee type.
 *
 * Given:
 *   scrutineeIndices — the type indices of the scrutinee (what we're matching on)
 *   ctor             — the constructor being matched
 *
 * Returns the set of equalities { scrutineeIndex_i ~ ctorReturnIndex_i }
 * plus any constraints declared by the constructor.
 */
export function extractRefinements(
  scrutineeIndices: Type[],
  ctor: GADTConstructor
): TypeEquality[] {
  const equalities: TypeEquality[] = [...ctor.constraints];

  for (let i = 0; i < scrutineeIndices.length; i++) {
    if (i < ctor.returnIndices.length) {
      equalities.push({
        lhs: scrutineeIndices[i],
        rhs: ctor.returnIndices[i],
      });
    }
  }

  return equalities;
}

/**
 * Instantiate a GADT constructor's type scheme, producing a fresh copy
 * with fresh metavariables for existentials.
 */
export function instantiateConstructor(
  ctor: GADTConstructor,
  typeArgs: Map<TypeVarId, Type>
): { fields: Type[]; returnType: Type; residualConstraints: TypeEquality[] } {
  const subst = new Map(typeArgs);

  const fields = ctor.fields.map((f) => applySubstitution(f, subst));
  const returnType = applySubstitution(ctor.returnType, subst);
  const residualConstraints = ctor.constraints.map((c) => ({
    lhs: applySubstitution(c.lhs, subst),
    rhs: applySubstitution(c.rhs, subst),
  }));

  return { fields, returnType, residualConstraints };
}

export function applySubstitution(ty: Type, subst: Map<TypeVarId, Type>): Type {
  switch (ty.tag) {
    case TypeTag.Var: {
      const replacement = subst.get(ty.id);
      return replacement ?? ty;
    }
    case TypeTag.Constructor:
      return { ...ty, args: ty.args.map((a) => applySubstitution(a, subst)) };
    case TypeTag.Arrow:
      return {
        ...ty,
        param: applySubstitution(ty.param, subst),
        result: applySubstitution(ty.result, subst),
      };
    case TypeTag.Forall:
      return { ...ty, body: applySubstitution(ty.body, subst) };
    case TypeTag.Exists:
      return { ...ty, body: applySubstitution(ty.body, subst) };
    case TypeTag.App:
      return {
        ...ty,
        constructor: applySubstitution(ty.constructor, subst),
        argument: applySubstitution(ty.argument, subst),
      };
    case TypeTag.Rigid:
      return ty;
    case TypeTag.Meta:
      if (ty.ref.contents) {
        return applySubstitution(ty.ref.contents, subst);
      }
      return ty;
    case TypeTag.Refined:
      return {
        ...ty,
        base: applySubstitution(ty.base, subst),
        constraints: ty.constraints.map((c) => ({
          lhs: applySubstitution(c.lhs, subst),
          rhs: applySubstitution(c.rhs, subst),
        })),
      };
  }
}
