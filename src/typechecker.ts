// ============================================================
// Type Checker with GADT Pattern Matching & Refinement
// ============================================================
// Stage  : 3b — Bidirectional inference and GADT refinement
// Input  : Expr, Pattern from ast; GADTDeclaration from gadt; Type from types
// Output : TypeEnv, infer, check, registerGADT, checkExhaustiveness
// Deps   : types, gadt, ast, unification

import {
  Type,
  TypeTag,
  TypeEquality,
  TypeVarId,
  Kind,
  KindTag,
  tVar,
  tCon,
  tArrow,
  tMeta,
  tRigid,
  tForall,
  kStar,
  freshId,
  TMeta,
} from "./types";
import {
  GADTDeclaration,
  GADTConstructor,
  GADTTypeParam,
  extractRefinements,
  applySubstitution,
} from "./gadt";
import { Expr, Pattern, MatchBranch, PConstructor } from "./ast";
import {
  unify,
  zonk,
  applyRefinements,
  prettyType,
  UnificationError,
} from "./unification";

// ============================================================
// Typing Environment
// ============================================================

export interface TypeEnv {
  /** Term variable bindings */
  variables: Map<string, Type>;
  /** GADT declarations */
  gadtDecls: Map<string, GADTDeclaration>;
  /** Constructor → GADT name + constructor info */
  constructors: Map<string, { gadtName: string; ctor: GADTConstructor }>;
  /** Active type equalities from GADT refinements */
  refinements: TypeEquality[];
  /** Rigid type variables in scope (for skolem escape check) */
  rigidsInScope: Set<TypeVarId>;
}

export function emptyEnv(): TypeEnv {
  return {
    variables: new Map(),
    gadtDecls: new Map(),
    constructors: new Map(),
    refinements: [],
    rigidsInScope: new Set(),
  };
}

function extendEnv(env: TypeEnv, name: string, ty: Type): TypeEnv {
  const variables = new Map(env.variables);
  variables.set(name, ty);
  return { ...env, variables };
}

function extendRefinements(env: TypeEnv, eqs: TypeEquality[]): TypeEnv {
  return { ...env, refinements: [...env.refinements, ...eqs] };
}

function extendRigids(env: TypeEnv, ids: TypeVarId[]): TypeEnv {
  const rigidsInScope = new Set(env.rigidsInScope);
  ids.forEach((id) => rigidsInScope.add(id));
  return { ...env, rigidsInScope };
}

/** Register a GADT declaration in the environment. */
export function registerGADT(env: TypeEnv, decl: GADTDeclaration): TypeEnv {
  const gadtDecls = new Map(env.gadtDecls);
  gadtDecls.set(decl.name, decl);

  const constructors = new Map(env.constructors);
  for (const ctor of decl.constructors) {
    constructors.set(ctor.name, { gadtName: decl.name, ctor });
  }

  return { ...env, gadtDecls, constructors };
}

// ============================================================
// Type Inference / Checking
// ============================================================

export function infer(env: TypeEnv, expr: Expr): Type {
  switch (expr.tag) {
    case "ELiteral":
      return inferLiteral(expr);

    case "EVar": {
      const ty = env.variables.get(expr.name);
      if (!ty) throw new TypeError(`Unbound variable: ${expr.name}`);
      return instantiateScheme(ty);
    }

    case "ELambda": {
      const paramTy = expr.paramType ?? tMeta();
      const bodyEnv = extendEnv(env, expr.param, paramTy);
      const bodyTy = infer(bodyEnv, expr.body);
      return tArrow(paramTy, bodyTy);
    }

    case "EApp": {
      const funcTy = infer(env, expr.func);
      const argTy = infer(env, expr.arg);
      const resultTy = tMeta();
      unify(funcTy, tArrow(argTy, resultTy));
      return zonk(resultTy);
    }

    case "ELet": {
      const valueTy = expr.annotation
        ? check(env, expr.value, expr.annotation)
        : infer(env, expr.value);
      const bodyEnv = extendEnv(env, expr.name, generalize(env, valueTy));
      return infer(bodyEnv, expr.body);
    }

    case "EAnnot": {
      check(env, expr.expr, expr.annotation);
      return expr.annotation;
    }

    case "EConstruct":
      return inferConstruct(env, expr);

    case "EMatch":
      return inferMatch(env, expr);

    case "EIf": {
      check(env, expr.cond, tCon("Bool"));
      const thenTy = infer(env, expr.then);
      const elseTy = infer(env, expr.else);
      unify(thenTy, elseTy);
      return zonk(thenTy);
    }

    case "ETyAbs": {
      const rigid = tRigid(expr.typeVar.name);
      const bodyEnv = extendRigids(env, [rigid.id]);
      const bodyTy = infer(bodyEnv, expr.body);
      return tForall(expr.typeVar, expr.kind, bodyTy);
    }

    case "ETyApp": {
      const exprTy = infer(env, expr.expr);
      const zonked = zonk(exprTy);
      if (zonked.tag !== TypeTag.Forall) {
        throw new TypeError(`Expected forall type, got ${prettyType(zonked)}`);
      }
      return applySubstitution(
        zonked.body,
        new Map([[zonked.variable.id, expr.typeArg]]),
      );
    }
  }
}

export function check(env: TypeEnv, expr: Expr, expected: Type): Type {
  const inferred = infer(env, expr);
  unify(inferred, expected);
  return zonk(expected);
}

function inferLiteral(expr: { value: number | boolean | string }): Type {
  if (typeof expr.value === "number") return tCon("Int");
  if (typeof expr.value === "boolean") return tCon("Bool");
  return tCon("String");
}

/** Instantiate a polymorphic type scheme with fresh metavariables. */
function instantiateScheme(ty: Type): Type {
  if (ty.tag === TypeTag.Forall) {
    const meta = tMeta();
    const body = applySubstitution(ty.body, new Map([[ty.variable.id, meta]]));
    return instantiateScheme(body);
  }
  return ty;
}

/** Generalize a type over all free metavariables not in the environment. */
function generalize(env: TypeEnv, ty: Type): Type {
  const zonked = zonk(ty);
  const freeMetas = freeMetaVars(zonked);
  let result = zonked;
  for (const meta of freeMetas) {
    const tv = tVar(`t${meta.id}`);
    meta.ref.contents = tv;
    result = tForall(tv, kStar, zonk(result));
  }
  return result;
}

function freeMetaVars(
  ty: Type,
  acc: TMeta[] = [],
  seen = new Set<TypeVarId>(),
): TMeta[] {
  const t = zonk(ty);
  switch (t.tag) {
    case TypeTag.Meta:
      if (!seen.has(t.id)) {
        seen.add(t.id);
        acc.push(t);
      }
      break;
    case TypeTag.Constructor:
      t.args.forEach((a) => freeMetaVars(a, acc, seen));
      break;
    case TypeTag.Arrow:
      freeMetaVars(t.param, acc, seen);
      freeMetaVars(t.result, acc, seen);
      break;
    case TypeTag.Forall:
    case TypeTag.Exists:
      freeMetaVars(t.body, acc, seen);
      break;
    case TypeTag.App:
      freeMetaVars(t.constructor, acc, seen);
      freeMetaVars(t.argument, acc, seen);
      break;
  }
  return acc;
}

// ============================================================
// GADT Construction Inference
// ============================================================

function inferConstruct(
  env: TypeEnv,
  expr: { constructor: string; typeArgs: Type[]; args: Expr[] },
): Type {
  const info = env.constructors.get(expr.constructor);
  if (!info) throw new TypeError(`Unknown constructor: ${expr.constructor}`);

  const { gadtName, ctor } = info;
  const decl = env.gadtDecls.get(gadtName)!;

  // Create fresh metas for all universals
  const typeArgMap = new Map<TypeVarId, Type>();
  for (let i = 0; i < ctor.universals.length; i++) {
    const uni = ctor.universals[i];
    const arg = i < expr.typeArgs.length ? expr.typeArgs[i] : tMeta();
    typeArgMap.set(uni.variable.id, arg);
  }

  // Create fresh metas for existentials
  for (const ex of ctor.existentials) {
    typeArgMap.set(ex.variable.id, tMeta());
  }

  // Instantiate field types and return type
  const fieldTypes = ctor.fields.map((f) => applySubstitution(f, typeArgMap));
  const returnType = applySubstitution(ctor.returnType, typeArgMap);

  // Apply declared constraints
  const constraints = ctor.constraints.map((c) => ({
    lhs: applySubstitution(c.lhs, typeArgMap),
    rhs: applySubstitution(c.rhs, typeArgMap),
  }));
  applyRefinements(constraints);

  // Check arguments
  if (expr.args.length !== fieldTypes.length) {
    throw new TypeError(
      `Constructor ${expr.constructor} expects ${fieldTypes.length} args, got ${expr.args.length}`,
    );
  }
  for (let i = 0; i < expr.args.length; i++) {
    check(env, expr.args[i], fieldTypes[i]);
  }

  return zonk(returnType);
}

// ============================================================
// GADT Pattern Match Inference (the core of GADT checking)
// ============================================================

/**
 * Infer the type of a match expression.
 *
 * Key GADT property: each branch may refine the type environment
 * based on the constructor matched. The scrutinee type's indices
 * are unified with the constructor's return indices, yielding
 * local type equalities that are in scope only within that branch.
 */
function inferMatch(
  env: TypeEnv,
  expr: { scrutinee: Expr; branches: MatchBranch[] },
): Type {
  const scrutineeTy = zonk(infer(env, expr.scrutinee));
  const resultTy = tMeta();

  for (const branch of expr.branches) {
    inferBranch(env, scrutineeTy, resultTy, branch);
  }

  return zonk(resultTy);
}

function inferBranch(
  env: TypeEnv,
  scrutineeTy: Type,
  resultTy: TMeta | Type,
  branch: MatchBranch,
): void {
  const { pattern, body, guard } = branch;

  // Extend environment with pattern bindings and refinements
  const { bindings, refinements } = checkPattern(env, pattern, scrutineeTy);

  // Store refinements on the branch for later phases
  branch.refinements = refinements;

  // Apply GADT refinements: unify the equalities in a local scope
  // We create fresh metas to avoid polluting the outer scope for rigids
  let branchEnv = env;
  for (const [name, ty] of bindings) {
    branchEnv = extendEnv(branchEnv, name, ty);
  }
  branchEnv = extendRefinements(branchEnv, refinements);

  // Apply the refinements to the unification state
  applyRefinements(refinements);

  // Check guard if present
  if (guard) {
    check(branchEnv, guard, tCon("Bool"));
  }

  // Infer body type and unify with result
  const bodyTy = infer(branchEnv, body);
  unify(bodyTy, resultTy);
}

/**
 * Check a pattern against an expected type, extracting:
 *  - Variable bindings (name → type)
 *  - Type refinements (equalities from GADT constructor matching)
 */
function checkPattern(
  env: TypeEnv,
  pattern: Pattern,
  expected: Type,
): { bindings: Map<string, Type>; refinements: TypeEquality[] } {
  switch (pattern.tag) {
    case "PWildcard":
      return { bindings: new Map(), refinements: [] };

    case "PVar": {
      const bindings = new Map<string, Type>();
      bindings.set(pattern.name, expected);
      pattern.type = expected;
      return { bindings, refinements: [] };
    }

    case "PLiteral": {
      const litTy = inferLiteral(pattern);
      unify(litTy, expected);
      return { bindings: new Map(), refinements: [] };
    }

    case "PConstructor":
      return checkConstructorPattern(env, pattern, expected);
  }
}

/**
 * The heart of GADT type checking: constructor pattern matching.
 *
 * When matching `(ctor p1 ... pN)` against expected type `T<i1, ..., iK>`:
 *
 * 1. Look up the constructor's declaration
 * 2. Create fresh metas for universal type params
 * 3. Create fresh rigid vars for existential type params
 * 4. Unify the constructor's return type with the expected type
 *    → This yields type equalities (GADT refinements!)
 * 5. Recursively check sub-patterns against the field types
 * 6. Return bindings and refinements
 */
function checkConstructorPattern(
  env: TypeEnv,
  pattern: PConstructor,
  expected: Type,
): { bindings: Map<string, Type>; refinements: TypeEquality[] } {
  const info = env.constructors.get(pattern.constructor);
  if (!info) {
    throw new TypeError(
      `Unknown constructor in pattern: ${pattern.constructor}`,
    );
  }

  const { gadtName, ctor } = info;
  pattern.resolvedCtor = ctor;

  // Step 1: Fresh metas for universals
  const typeArgMap = new Map<TypeVarId, Type>();
  for (const uni of ctor.universals) {
    typeArgMap.set(uni.variable.id, tMeta());
  }

  // Step 2: Fresh rigid vars for existentials (skolemized)
  const newRigids: TypeVarId[] = [];
  for (const ex of ctor.existentials) {
    const rigid = tRigid(ex.variable.name);
    newRigids.push(rigid.id);
    typeArgMap.set(ex.variable.id, rigid);
  }

  // Step 3: Instantiate return type and field types
  const returnType = applySubstitution(ctor.returnType, typeArgMap);
  const fieldTypes = ctor.fields.map((f) => applySubstitution(f, typeArgMap));

  // Step 4: Unify return type with expected type → GADT refinement!
  //   This is where the magic happens. If ctor returns `Expr Int` and
  //   expected is `Expr a`, we learn `a ~ Int`.
  unify(returnType, expected);

  // Step 5: Extract the refinements
  const scrutineeIndices = extractIndices(expected);
  const ctorIndices = extractIndices(returnType);
  const refinements: TypeEquality[] = [];
  for (
    let i = 0;
    i < Math.min(scrutineeIndices.length, ctorIndices.length);
    i++
  ) {
    refinements.push({ lhs: scrutineeIndices[i], rhs: ctorIndices[i] });
  }
  // Add constructor's own constraints
  for (const c of ctor.constraints) {
    refinements.push({
      lhs: applySubstitution(c.lhs, typeArgMap),
      rhs: applySubstitution(c.rhs, typeArgMap),
    });
  }

  // Step 6: Check sub-patterns
  if (pattern.subPatterns.length !== fieldTypes.length) {
    throw new TypeError(
      `Constructor ${pattern.constructor} has ${fieldTypes.length} fields, ` +
        `but pattern has ${pattern.subPatterns.length} sub-patterns`,
    );
  }

  let allBindings = new Map<string, Type>();
  for (let i = 0; i < fieldTypes.length; i++) {
    const { bindings } = checkPattern(
      env,
      pattern.subPatterns[i],
      fieldTypes[i],
    );
    for (const [name, ty] of bindings) {
      allBindings.set(name, ty);
    }
  }

  return { bindings: allBindings, refinements };
}

/** Extract type indices from a GADT application type. */
function extractIndices(ty: Type): Type[] {
  const t = zonk(ty);
  if (t.tag === TypeTag.Constructor) {
    return t.args;
  }
  if (t.tag === TypeTag.App) {
    const indices: Type[] = [];
    let current: Type = t;
    while (current.tag === TypeTag.App) {
      indices.unshift(current.argument);
      current = current.constructor;
    }
    return indices;
  }
  return [];
}

// ============================================================
// Exhaustiveness Checking for GADT Patterns
// ============================================================

export interface ExhaustivenessResult {
  isExhaustive: boolean;
  missingConstructors: string[];
  redundantBranches: number[];
}

export function checkExhaustiveness(
  env: TypeEnv,
  scrutineeTy: Type,
  branches: MatchBranch[],
): ExhaustivenessResult {
  const t = zonk(scrutineeTy);
  const gadtName = extractGADTName(t);
  if (!gadtName) {
    return {
      isExhaustive: true,
      missingConstructors: [],
      redundantBranches: [],
    };
  }

  const decl = env.gadtDecls.get(gadtName);
  if (!decl) {
    return {
      isExhaustive: true,
      missingConstructors: [],
      redundantBranches: [],
    };
  }

  // Get type indices of scrutinee
  const indices = extractIndices(t);

  // Determine which constructors are inhabitable given the indices
  const inhabitableCtors = decl.constructors.filter((ctor) => {
    // A constructor is inhabitable if its return indices can unify with the scrutinee indices
    const typeArgMap = new Map<TypeVarId, Type>();
    for (const uni of ctor.universals) {
      typeArgMap.set(uni.variable.id, tMeta());
    }
    for (const ex of ctor.existentials) {
      typeArgMap.set(ex.variable.id, tMeta());
    }
    const retIndices = ctor.returnIndices.map((idx) =>
      applySubstitution(idx, typeArgMap),
    );

    // Try unification speculatively
    try {
      for (let i = 0; i < Math.min(indices.length, retIndices.length); i++) {
        // Use a fresh copy to avoid mutating
        const lhsMeta = tMeta();
        const rhsMeta = tMeta();
        unify(lhsMeta, indices[i]);
        unify(rhsMeta, retIndices[i]);
        // If the indices are concrete and incompatible, this constructor is uninhabitable
      }
      return true;
    } catch {
      return false;
    }
  });

  const matchedCtors = new Set<string>();
  const redundantBranches: number[] = [];

  for (let i = 0; i < branches.length; i++) {
    const pat = branches[i].pattern;
    if (pat.tag === "PConstructor") {
      if (matchedCtors.has(pat.constructor)) {
        redundantBranches.push(i);
      }
      matchedCtors.add(pat.constructor);
    } else if (pat.tag === "PWildcard" || pat.tag === "PVar") {
      // Wildcard/var covers everything
      for (const ctor of inhabitableCtors) {
        matchedCtors.add(ctor.name);
      }
    }
  }

  const missingConstructors = inhabitableCtors
    .filter((c) => !matchedCtors.has(c.name))
    .map((c) => c.name);

  return {
    isExhaustive: missingConstructors.length === 0,
    missingConstructors,
    redundantBranches,
  };
}

function extractGADTName(ty: Type): string | null {
  if (ty.tag === TypeTag.Constructor) return ty.id;
  if (ty.tag === TypeTag.App) {
    let current: Type = ty;
    while (current.tag === TypeTag.App) {
      current = current.constructor;
    }
    if (current.tag === TypeTag.Constructor) return current.id;
  }
  return null;
}
