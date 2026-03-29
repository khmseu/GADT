// ============================================================
// Pretty Printing for Core IR and Types
// ============================================================
// Stage  : 6 — Human-readable output
// Input  : Type, Kind from types; CoreExpr, Coercion from ir; GADTDeclaration from gadt
// Output : prettyKind, prettyGADT, prettyCoreExpr, prettyCoercion
// Deps   : types, ir, gadt, unification

import { Type, TypeTag, Kind, KindTag } from "./types";
import { CoreExpr, CoreAlt, Coercion, coreExprType } from "./ir";
import { GADTDeclaration, GADTConstructor } from "./gadt";
import { zonk, prettyType } from "./unification";

export function prettyKind(k: Kind): string {
  switch (k.tag) {
    case KindTag.Star:
      return "*";
    case KindTag.Arrow:
      return `(${prettyKind(k.from)} -> ${prettyKind(k.to)})`;
    case KindTag.Constraint:
      return "Constraint";
  }
}

export function prettyGADT(decl: GADTDeclaration): string {
  const params = decl.typeParams
    .map((p) => `(${p.variable.name} : ${prettyKind(p.kind)})`)
    .join(" ");
  const lines = [`data ${decl.name} ${params} where`];
  for (const ctor of decl.constructors) {
    lines.push(`  ${prettyCtor(ctor)}`);
  }
  return lines.join("\n");
}

function prettyCtor(ctor: GADTConstructor): string {
  const existentials =
    ctor.existentials.length > 0
      ? `∀${ctor.existentials.map((e) => e.variable.name).join(" ")}. `
      : "";
  const constraints =
    ctor.constraints.length > 0
      ? `(${ctor.constraints.map((c) => `${prettyType(c.lhs)} ~ ${prettyType(c.rhs)}`).join(", ")}) => `
      : "";
  const fields = ctor.fields.map(prettyType).join(" -> ");
  const arrow = fields ? ` -> ` : "";
  return `${ctor.name} : ${existentials}${constraints}${fields}${arrow}${prettyType(ctor.returnType)}`;
}

export function prettyCoreExpr(expr: CoreExpr, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (expr.tag) {
    case "CoreLit":
      return `${pad}${JSON.stringify(expr.value)} : ${prettyType(expr.type)}`;

    case "CoreVar":
      return `${pad}${expr.name} : ${prettyType(expr.type)}`;

    case "CoreLam":
      return `${pad}(λ${expr.param} : ${prettyType(expr.paramType)}.\n${prettyCoreExpr(expr.body, indent + 1)}\n${pad})`;

    case "CoreApp":
      return `${pad}(${prettyCoreExpr(expr.func, 0)} @ ${prettyCoreExpr(expr.arg, 0)})`;

    case "CoreTyLam":
      return `${pad}(Λ${expr.typeVar.name}.\n${prettyCoreExpr(expr.body, indent + 1)}\n${pad})`;

    case "CoreTyApp":
      return `${pad}(${prettyCoreExpr(expr.expr, 0)} @[${prettyType(expr.typeArg)}])`;

    case "CoreLet":
      return `${pad}let ${expr.name} : ${prettyType(expr.type)} =\n${prettyCoreExpr(expr.value, indent + 1)}\n${pad}in\n${prettyCoreExpr(expr.body, indent + 1)}`;

    case "CoreCase":
      const alts = expr.alternatives
        .map((a) => prettyCoreAlt(a, indent + 1))
        .join("\n");
      return `${pad}case ${prettyCoreExpr(expr.scrutinee, 0)} : ${prettyType(expr.scrutineeType)} of\n${alts}\n${pad}: ${prettyType(expr.resultType)}`;

    case "CoreConstruct": {
      const typeArgs =
        expr.typeArgs.length > 0
          ? `@[${expr.typeArgs.map(prettyType).join(", ")}]`
          : "";
      const args = expr.args.map((a) => prettyCoreExpr(a, 0)).join(", ");
      return `${pad}${expr.constructor}${typeArgs}(${args}) : ${prettyType(expr.type)}`;
    }

    case "CoreCast":
      return `${pad}(${prettyCoreExpr(expr.expr, 0)} ▷ ${prettyCoercion(expr.coercion)}) : ${prettyType(expr.type)}`;
  }
}

function prettyCoreAlt(alt: CoreAlt, indent: number): string {
  const pad = "  ".repeat(indent);
  const exVars =
    alt.existentials.length > 0
      ? ` ∃${alt.existentials.map((e) => e.var.name).join(" ")}.`
      : "";
  const coercions =
    alt.coercions.length > 0
      ? ` [${alt.coercions.map(prettyCoercion).join(", ")}]`
      : "";
  const binds = alt.bindings
    .map((b) => `${b.name}:${prettyType(b.type)}`)
    .join(", ");
  return `${pad}| ${alt.constructor}${exVars}${coercions}(${binds}) ->\n${prettyCoreExpr(alt.body, indent + 1)}`;
}

export function prettyCoercion(co: Coercion): string {
  switch (co.tag) {
    case "CoRefl":
      return `refl(${prettyType(co.type)})`;
    case "CoSym":
      return `sym(${prettyCoercion(co.coercion)})`;
    case "CoTrans":
      return `trans(${prettyCoercion(co.first)}, ${prettyCoercion(co.second)})`;
    case "CoArrow":
      return `arrow(${prettyCoercion(co.param)}, ${prettyCoercion(co.result)})`;
    case "CoApp":
      return `app(${prettyCoercion(co.constructor)}, ${prettyCoercion(co.argument)})`;
    case "CoForall":
      return `forall(${co.variable.name}, ${prettyCoercion(co.body)})`;
    case "CoAxiom":
      return `axiom(${co.name}: ${prettyType(co.lhs)} ~ ${prettyType(co.rhs)})`;
    case "CoVar":
      return `co_${co.name}`;
  }
}
