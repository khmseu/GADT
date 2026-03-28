// ============================================================
// Elaboration: Surface AST → Core IR with Explicit Coercions
// ============================================================

import {
  Type, TypeTag, TypeEquality, TypeVarId,
  tVar, tCon, tArrow, tMeta, tRigid, kStar, freshId,
} from "./types";
import { applySubstitution, GADTConstructor } from "./gadt";
import { Expr, MatchBranch, Pattern, PConstructor } from "./ast";
import {
  CoreExpr, CoreAlt, Coercion,
  coRefl, coAxiom, coreExprType,
} from "./ir";
import { TypeEnv, infer, check } from "./typechecker";
import { zonk, prettyType, unify } from "./unification";

/**
 * Elaborate a surface expression into the core IR,
 * making GADT evidence explicit via coercions.
 */
export function elaborate(env: TypeEnv, expr: Expr): CoreExpr {
  switch (expr.tag) {
    case "ELiteral": {
      const ty = typeof expr.value === "number" ? tCon("Int")
               : typeof expr.value === "boolean" ? tCon("Bool")
               : tCon("String");
      return { tag: "CoreLit", value: expr.value, type: ty };
    }

    case "EVar": {
      const ty = env.variables.get(expr.name);
      if (!ty) throw new Error(`Unbound: ${expr.name}`);
      return { tag: "CoreVar", name: expr.name, type: ty };
    }

    case "ELambda": {
      const paramTy = expr.paramType ?? tMeta();
      const bodyEnv = extendEnvLocal(env, expr.param, paramTy);
      const coreBody = elaborate(bodyEnv, expr.body);
      const bodyTy = coreExprType(coreBody);
      return {
        tag: "CoreLam",
        param: expr.param,
        paramType: paramTy,
        body: coreBody,
        type: tArrow(paramTy, bodyTy),
      };
    }

    case "EApp": {
      const coreFunc = elaborate(env, expr.func);
      const coreArg = elaborate(env, expr.arg);
      const funcTy = coreExprType(coreFunc);
      const resultTy = tMeta();
      unify(funcTy, tArrow(coreExprType(coreArg), resultTy));
      return {
        tag: "CoreApp",
        func: coreFunc,
        arg: coreArg,
        type: zonk(resultTy),
      };
    }

    case "ELet": {
      const coreValue = elaborate(env, expr.value);
      const valueTy = coreExprType(coreValue);
      const bodyEnv = extendEnvLocal(env, expr.name, valueTy);
      const coreBody = elaborate(bodyEnv, expr.body);
      return {
        tag: "CoreLet",
        name: expr.name,
        type: valueTy,
        value: coreValue,
        body: coreBody,
      };
    }

    case "EAnnot":
      return elaborate(env, expr.expr);

    case "EConstruct": {
      const info = env.constructors.get(expr.constructor);
      if (!info) throw new Error(`Unknown ctor: ${expr.constructor}`);
      const coreArgs = expr.args.map((a) => elaborate(env, a));
      const ty = infer(env, expr);
      return {
        tag: "CoreConstruct",
        constructor: expr.constructor,
        typeArgs: expr.typeArgs,
        args: coreArgs,
        type: zonk(ty),
      };
    }

    case "EMatch":
      return elaborateMatch(env, expr);

    case "EIf": {
      const coreCond = elaborate(env, expr.cond);
      const coreThen = elaborate(env, expr.then);
      const coreElse = elaborate(env, expr.else);
      return {
        tag: "CoreCase",
        scrutinee: coreCond,
        scrutineeType: tCon("Bool"),
        alternatives: [
          {
            constructor: "True",
            existentials: [],
            coercions: [],
            bindings: [],
            body: coreThen,
          },
          {
            constructor: "False",
            existentials: [],
            coercions: [],
            bindings: [],
            body: coreElse,
          },
        ],
        resultType: coreExprType(coreThen),
      };
    }

    case "ETyAbs": {
      const rigid = tRigid(expr.typeVar.name);
      const bodyEnv = { ...env, rigidsInScope: new Set([...env.rigidsInScope, rigid.id]) };
      const coreBody = elaborate(bodyEnv, expr.body);
      const bodyTy = coreExprType(coreBody);
      return {
        tag: "CoreTyLam",
        typeVar: expr.typeVar,
        kind: expr.kind,
        body: coreBody,
        type: { tag: TypeTag.Forall, variable: expr.typeVar, kind: expr.kind, body: bodyTy },
      };
    }

    case "ETyApp": {
      const coreExpr = elaborate(env, expr.expr);
      const exprTy = zonk(coreExprType(coreExpr));
      if (exprTy.tag !== TypeTag.Forall) throw new Error("Expected forall");
      const resultTy = applySubstitution(exprTy.body, new Map([[exprTy.variable.id, expr.typeArg]]));
      return {
        tag: "CoreTyApp",
        expr: coreExpr,
        typeArg: expr.typeArg,
        type: resultTy,
      };
    }
  }
}

/**
 * Elaborate a match expression, producing a CoreCase
 * with explicit coercions for GADT refinements.
 */
function elaborateMatch(
  env: TypeEnv,
  expr: { scrutinee: Expr; branches: MatchBranch[] }
): CoreExpr {
  const coreScrutinee = elaborate(env, expr.scrutinee);
  const scrutineeTy = zonk(coreExprType(coreScrutinee));
  const resultTy = tMeta();

  const alternatives: CoreAlt[] = [];

  for (const branch of expr.branches) {
    const alt = elaborateBranch(env, scrutineeTy, resultTy, branch);
    alternatives.push(alt);
  }

  return {
    tag: "CoreCase",
    scrutinee: coreScrutinee,
    scrutineeType: scrutineeTy,
    alternatives,
    resultType: zonk(resultTy),
  };
}

function elaborateBranch(
  env: TypeEnv,
  scrutineeTy: Type,
  resultTy: Type,
  branch: MatchBranch
): CoreAlt {
  const { pattern, body } = branch;

  if (pattern.tag === "PConstructor") {
    return elaborateConstructorBranch(env, scrutineeTy, resultTy, pattern, body);
  }

  // Wildcard / variable pattern — no refinements
  let branchEnv = env;
  if (pattern.tag === "PVar") {
    branchEnv = extendEnvLocal(env, pattern.name, scrutineeTy);
  }

  const coreBody = elaborate(branchEnv, body);
  unify(coreExprType(coreBody), resultTy);

  return {
    constructor: pattern.tag === "PVar" ? `@var(${pattern.name})` : "@wildcard",
    existentials: [],
    coercions: [],
    bindings: pattern.tag === "PVar" ? [{ name: pattern.name, type: scrutineeTy }] : [],
    body: coreBody,
  };
}

function elaborateConstructorBranch(
  env: TypeEnv,
  scrutineeTy: Type,
  resultTy: Type,
  pattern: PConstructor,
  body: Expr
): CoreAlt {
  const info = env.constructors.get(pattern.constructor);
  if (!info) throw new Error(`Unknown ctor: ${pattern.constructor}`);
  const { ctor } = info;

  // Fresh metas for universals
  const typeArgMap = new Map<TypeVarId, Type>();
  for (const uni of ctor.universals) {
    typeArgMap.set(uni.variable.id, tMeta());
  }

  // Rigid vars for existentials
  const existentialBindings: Array<{ var: typeof tVar extends (...a: any) => infer R ? R : never; kind: typeof kStar }> = [];
  for (const ex of ctor.existentials) {
    const rigid = tRigid(ex.variable.name);
    typeArgMap.set(ex.variable.id, rigid);
    existentialBindings.push({ var: tVar(ex.variable.name, rigid.id), kind: ex.kind });
  }

  // Instantiate
  const returnType = applySubstitution(ctor.returnType, typeArgMap);
  const fieldTypes = ctor.fields.map((f) => applySubstitution(f, typeArgMap));

  // Unify with scrutinee type → extracts GADT refinements
  unify(returnType, scrutineeTy);

  // Build coercions from type equalities
  const coercions: Coercion[] = [];
  const scrutineeIndices = extractTypeIndices(scrutineeTy);
  const returnIndices = extractTypeIndices(returnType);
  for (let i = 0; i < Math.min(scrutineeIndices.length, returnIndices.length); i++) {
    const lhs = zonk(scrutineeIndices[i]);
    const rhs = zonk(returnIndices[i]);
    coercions.push(coAxiom(
      `${pattern.constructor}_co_${i}`,
      lhs,
      rhs
    ));
  }
  // Add ctor constraints as coercions
  for (let i = 0; i < ctor.constraints.length; i++) {
    const c = ctor.constraints[i];
    coercions.push(coAxiom(
      `${pattern.constructor}_constraint_${i}`,
      applySubstitution(c.lhs, typeArgMap),
      applySubstitution(c.rhs, typeArgMap),
    ));
  }

  // Build bindings from sub-patterns
  const bindings: Array<{ name: string; type: Type }> = [];
  let branchEnv = env;
  for (let i = 0; i < pattern.subPatterns.length && i < fieldTypes.length; i++) {
    const sub = pattern.subPatterns[i];
    const fieldTy = zonk(fieldTypes[i]);
    if (sub.tag === "PVar") {
      bindings.push({ name: sub.name, type: fieldTy });
      branchEnv = extendEnvLocal(branchEnv, sub.name, fieldTy);
    }
  }

  const coreBody = elaborate(branchEnv, body);
  unify(coreExprType(coreBody), resultTy);

  return {
    constructor: pattern.constructor,
    existentials: existentialBindings,
    coercions,
    bindings,
    body: coreBody,
  };
}

function extractTypeIndices(ty: Type): Type[] {
  const t = zonk(ty);
  if (t.tag === TypeTag.Constructor) return t.args;
  if (t.tag === TypeTag.App) {
    const indices: Type[] = [];
    let cur: Type = t;
    while (cur.tag === TypeTag.App) {
      indices.unshift(cur.argument);
      cur = cur.constructor;
    }
    return indices;
  }
  return [];
}

function extendEnvLocal(env: TypeEnv, name: string, ty: Type): TypeEnv {
  const variables = new Map(env.variables);
  variables.set(name, ty);
  return { ...env, variables };
}
