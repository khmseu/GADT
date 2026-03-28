// ============================================================
// Interpreter for Core IR (for testing / verification)
// ============================================================

import { CoreExpr, CoreAlt, coreExprType } from "./ir";
import { Type } from "./types";

export type Value =
  | { tag: "VLit"; value: number | boolean | string }
  | { tag: "VClosure"; param: string; body: CoreExpr; env: ValueEnv }
  | { tag: "VTyClosure"; body: CoreExpr; env: ValueEnv }
  | { tag: "VConstruct"; constructor: string; args: Value[] };

export type ValueEnv = Map<string, Value>;

export function evaluate(env: ValueEnv, expr: CoreExpr): Value {
  switch (expr.tag) {
    case "CoreLit":
      return { tag: "VLit", value: expr.value };

    case "CoreVar": {
      const val = env.get(expr.name);
      if (!val) throw new Error(`Unbound variable at runtime: ${expr.name}`);
      return val;
    }

    case "CoreLam":
      return { tag: "VClosure", param: expr.param, body: expr.body, env: new Map(env) };

    case "CoreApp": {
      const func = evaluate(env, expr.func);
      const arg = evaluate(env, expr.arg);
      if (func.tag !== "VClosure") throw new Error("Application of non-function");
      const newEnv = new Map(func.env);
      newEnv.set(func.param, arg);
      return evaluate(newEnv, func.body);
    }

    case "CoreTyLam":
      return { tag: "VTyClosure", body: expr.body, env: new Map(env) };

    case "CoreTyApp": {
      const val = evaluate(env, expr.expr);
      if (val.tag === "VTyClosure") {
        return evaluate(val.env, val.body);
      }
      return val;
    }

    case "CoreLet": {
      const val = evaluate(env, expr.value);
      const newEnv = new Map(env);
      newEnv.set(expr.name, val);
      return evaluate(newEnv, expr.body);
    }

    case "CoreCase": {
      const scrutinee = evaluate(env, expr.scrutinee);
      return evaluateCase(env, scrutinee, expr.alternatives);
    }

    case "CoreConstruct": {
      const args = expr.args.map((a) => evaluate(env, a));
      return { tag: "VConstruct", constructor: expr.constructor, args };
    }

    case "CoreCast":
      // Coercions are erased at runtime — just evaluate the inner expression
      return evaluate(env, expr.expr);
  }
}

function evaluateCase(env: ValueEnv, scrutinee: Value, alts: CoreAlt[]): Value {
  if (scrutinee.tag === "VConstruct") {
    for (const alt of alts) {
      if (alt.constructor === scrutinee.constructor) {
        const newEnv = new Map(env);
        for (let i = 0; i < alt.bindings.length && i < scrutinee.args.length; i++) {
          newEnv.set(alt.bindings[i].name, scrutinee.args[i]);
        }
        return evaluate(newEnv, alt.body);
      }
    }
    // Try wildcard / default
    for (const alt of alts) {
      if (alt.constructor.startsWith("@")) {
        const newEnv = new Map(env);
        if (alt.bindings.length > 0) {
          newEnv.set(alt.bindings[0].name, scrutinee);
        }
        return evaluate(newEnv, alt.body);
      }
    }
    throw new Error(`No matching alternative for constructor: ${scrutinee.tag === "VConstruct" ? scrutinee.constructor : "?"}`);
  }

  // Bool literals for if-then-else elaboration
  if (scrutinee.tag === "VLit" && typeof scrutinee.value === "boolean") {
    const ctorName = scrutinee.value ? "True" : "False";
    for (const alt of alts) {
      if (alt.constructor === ctorName) {
        return evaluate(env, alt.body);
      }
    }
  }

  throw new Error("Case scrutinee is not a constructed value");
}

export function prettyValue(val: Value): string {
  switch (val.tag) {
    case "VLit":
      return JSON.stringify(val.value);
    case "VClosure":
      return `<closure: λ${val.param}>`;
    case "VTyClosure":
      return `<type-closure>`;
    case "VConstruct":
      if (val.args.length === 0) return val.constructor;
      return `${val.constructor}(${val.args.map(prettyValue).join(", ")})`;
  }
}
