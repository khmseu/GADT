// ============================================================
// Full GADT Compiler Demo
// ============================================================
// Stage  : 7 — End-to-end demo wiring
// Input  : all pipeline stages
// Output : console output (type-checked & evaluated GADT programs)
// Deps   : types, gadt, ast, typechecker, elaboration, eval, prettyprint, unification

import {
  Type, TypeTag, TypeVarId, TVar,
  tVar, tCon, tArrow, tMeta, kStar, kArrow,
  resetIdCounter, freshId,
} from "./types";
import {
  GADTDeclaration, GADTConstructor, GADTTypeParam,
  gadtDeclaration,
} from "./gadt";
import { Expr, Pattern, MatchBranch, EMatch, EConstruct } from "./ast";
import { TypeEnv, emptyEnv, registerGADT, infer, checkExhaustiveness } from "./typechecker";
import { elaborate } from "./elaboration";
import { evaluate, prettyValue, ValueEnv } from "./eval";
import { prettyGADT, prettyCoreExpr, prettyCoercion } from "./prettyprint";
import { zonk, prettyType, unify } from "./unification";

// ============================================================
// Example 1: Classic typed expression GADT
//
//   data Expr (a : *) where
//     IntLit  : Int -> Expr Int
//     BoolLit : Bool -> Expr Bool
//     Add     : Expr Int -> Expr Int -> Expr Int
//     Eq      : Expr Int -> Expr Int -> Expr Bool
//     If      : Expr Bool -> Expr a -> Expr a -> Expr a
// ============================================================

function buildExprGADT(): GADTDeclaration {
  const a = tVar("a");
  const paramA: GADTTypeParam = { variable: a, kind: kStar };

  return gadtDeclaration("Expr", [paramA], [
    {
      name: "IntLit",
      existentials: [],
      constraints: [{ lhs: a, rhs: tCon("Int") }],
      fields: [tCon("Int")],
      returnType: tCon("Expr", [tCon("Int")]),
      returnIndices: [tCon("Int")],
    },
    {
      name: "BoolLit",
      existentials: [],
      constraints: [{ lhs: a, rhs: tCon("Bool") }],
      fields: [tCon("Bool")],
      returnType: tCon("Expr", [tCon("Bool")]),
      returnIndices: [tCon("Bool")],
    },
    {
      name: "Add",
      existentials: [],
      constraints: [{ lhs: a, rhs: tCon("Int") }],
      fields: [tCon("Expr", [tCon("Int")]), tCon("Expr", [tCon("Int")])],
      returnType: tCon("Expr", [tCon("Int")]),
      returnIndices: [tCon("Int")],
    },
    {
      name: "Eq",
      existentials: [],
      constraints: [{ lhs: a, rhs: tCon("Bool") }],
      fields: [tCon("Expr", [tCon("Int")]), tCon("Expr", [tCon("Int")])],
      returnType: tCon("Expr", [tCon("Bool")]),
      returnIndices: [tCon("Bool")],
    },
    {
      name: "If",
      existentials: [],
      constraints: [],
      fields: [tCon("Expr", [tCon("Bool")]), tCon("Expr", [a]), tCon("Expr", [a])],
      returnType: tCon("Expr", [a]),
      returnIndices: [a],
    },
  ]);
}

// ============================================================
// Example 2: Heterogeneous list (existential types)
//
//   data HList (n : *) where
//     HNil  : HList Zero
//     HCons : ∀a. a -> HList n -> HList (Succ n)
// ============================================================

function buildHListGADT(): GADTDeclaration {
  const n = tVar("n");
  const a = tVar("a_ex");
  const paramN: GADTTypeParam = { variable: n, kind: kStar };

  return gadtDeclaration("HList", [paramN], [
    {
      name: "HNil",
      existentials: [],
      constraints: [{ lhs: n, rhs: tCon("Zero") }],
      fields: [],
      returnType: tCon("HList", [tCon("Zero")]),
      returnIndices: [tCon("Zero")],
    },
    {
      name: "HCons",
      existentials: [{ variable: a, kind: kStar }],
      constraints: [],
      fields: [a, tCon("HList", [n])],
      returnType: tCon("HList", [tCon("Succ", [n])]),
      returnIndices: [tCon("Succ", [n])],
    },
  ]);
}

// ============================================================
// Example 3: Type-safe equality proof
//
//   data Equal (a : *) (b : *) where
//     Refl : Equal a a
// ============================================================

function buildEqualGADT(): GADTDeclaration {
  const a = tVar("a");
  const b = tVar("b");

  return gadtDeclaration("Equal", [
    { variable: a, kind: kStar },
    { variable: b, kind: kStar },
  ], [
    {
      name: "Refl",
      existentials: [],
      constraints: [{ lhs: a, rhs: b }],
      fields: [],
      returnType: tCon("Equal", [a, a]),
      returnIndices: [a, a],
    },
  ]);
}

// ============================================================
// Build and run the demo
// ============================================================

function demo() {
  resetIdCounter();

  const exprGADT = buildExprGADT();
  const hlistGADT = buildHListGADT();
  const equalGADT = buildEqualGADT();

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       Full GADT Compiler — Type System Demo             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // --- Print GADT declarations ---
  console.log("━━━ GADT Declarations ━━━\n");
  console.log(prettyGADT(exprGADT));
  console.log();
  console.log(prettyGADT(hlistGADT));
  console.log();
  console.log(prettyGADT(equalGADT));
  console.log();

  // --- Register GADTs ---
  let env = emptyEnv();
  env = registerGADT(env, exprGADT);
  env = registerGADT(env, hlistGADT);
  env = registerGADT(env, equalGADT);

  // --- Demo 1: Construct a typed expression ---
  console.log("━━━ Demo 1: Constructing GADT values ━━━\n");

  // Build: Add (IntLit 1) (IntLit 2) : Expr Int
  const expr1: Expr = {
    tag: "EConstruct",
    constructor: "Add",
    typeArgs: [],
    args: [
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 1 }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 2 }],
      },
    ],
  };

  const ty1 = infer(env, expr1);
  console.log(`Add (IntLit 1) (IntLit 2) : ${prettyType(zonk(ty1))}`);

  // Build: If (BoolLit true) (IntLit 42) (IntLit 0) : Expr Int
  const expr2: Expr = {
    tag: "EConstruct",
    constructor: "If",
    typeArgs: [],
    args: [
      {
        tag: "EConstruct",
        constructor: "BoolLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: true }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 42 }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 0 }],
      },
    ],
  };

  const ty2 = infer(env, expr2);
  console.log(`If (BoolLit true) (IntLit 42) (IntLit 0) : ${prettyType(zonk(ty2))}`);

  // Build: Eq (IntLit 1) (IntLit 2) : Expr Bool
  const expr3: Expr = {
    tag: "EConstruct",
    constructor: "Eq",
    typeArgs: [],
    args: [
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 1 }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 2 }],
      },
    ],
  };

  const ty3 = infer(env, expr3);
  console.log(`Eq (IntLit 1) (IntLit 2) : ${prettyType(zonk(ty3))}`);
  console.log();

  // --- Demo 2: Type-safe eval function via GADT pattern matching ---
  console.log("━━━ Demo 2: GADT Pattern Matching with Type Refinement ━━━\n");

  // eval : Expr Int -> Int
  // match e with
  //   | IntLit n -> n          (here we know a ~ Int, so n : Int)
  //   | Add l r  -> eval l + eval r
  //
  // Simulated as: match (IntLit 42) with | IntLit n -> n
  const matchExpr: Expr = {
    tag: "EMatch",
    scrutinee: {
      tag: "EConstruct",
      constructor: "IntLit",
      typeArgs: [],
      args: [{ tag: "ELiteral", value: 42 }],
    },
    branches: [
      {
        pattern: {
          tag: "PConstructor",
          constructor: "IntLit",
          existentials: [],
          subPatterns: [{ tag: "PVar", name: "n" }],
        },
        body: { tag: "EVar", name: "n" },
      },
      {
        pattern: {
          tag: "PConstructor",
          constructor: "Add",
          existentials: [],
          subPatterns: [{ tag: "PWildcard" }, { tag: "PWildcard" }],
        },
        body: { tag: "ELiteral", value: 0 }, // simplified: return zero for Add
      },
    ],
  };

  const matchTy = infer(env, matchExpr);
  console.log(`Pattern match result type: ${prettyType(zonk(matchTy))}`);
  console.log("  → In IntLit branch: n has type Int (GADT refinement: a ~ Int)");
  console.log("  → In Add branch: l has type Expr<Int> (GADT refinement: a ~ Int)");
  console.log();

  // --- Demo 3: Elaborate to Core IR ---
  console.log("━━━ Demo 3: Elaboration to Core IR ━━━\n");

  resetIdCounter();
  const env2 = registerGADT(registerGADT(registerGADT(emptyEnv(), exprGADT), hlistGADT), equalGADT);

  // Simple: IntLit 42
  const simpleConstruct: Expr = {
    tag: "EConstruct",
    constructor: "IntLit",
    typeArgs: [],
    args: [{ tag: "ELiteral", value: 42 }],
  };

  const coreExpr = elaborate(env2, simpleConstruct);
  console.log("Surface: IntLit 42");
  console.log("Core IR:");
  console.log(prettyCoreExpr(coreExpr, 1));
  console.log();

  // --- Demo 4: Evaluate through Core IR ---
  console.log("━━━ Demo 4: Evaluation ━━━\n");

  const runtime: ValueEnv = new Map();
  const val = evaluate(runtime, coreExpr);
  console.log(`IntLit(42) evaluates to: ${prettyValue(val)}`);

  // More complex: match (IntLit 42) { IntLit n -> n }
  resetIdCounter();
  const env3 = registerGADT(registerGADT(registerGADT(emptyEnv(), buildExprGADT()), buildHListGADT()), buildEqualGADT());

  const matchExpr2: Expr = {
    tag: "EMatch",
    scrutinee: {
      tag: "EConstruct",
      constructor: "IntLit",
      typeArgs: [],
      args: [{ tag: "ELiteral", value: 42 }],
    },
    branches: [
      {
        pattern: {
          tag: "PConstructor",
          constructor: "IntLit",
          existentials: [],
          subPatterns: [{ tag: "PVar", name: "n" }],
        },
        body: { tag: "EVar", name: "n" },
      },
    ],
  };

  const coreMatch = elaborate(env3, matchExpr2);
  console.log("\nSurface: match (IntLit 42) { IntLit n -> n }");
  console.log("Core IR:");
  console.log(prettyCoreExpr(coreMatch, 1));

  const matchVal = evaluate(new Map(), coreMatch);
  console.log(`\nEvaluates to: ${prettyValue(matchVal)}`);
  console.log();

  // --- Demo 5: Exhaustiveness checking ---
  console.log("━━━ Demo 5: Exhaustiveness Checking ━━━\n");

  resetIdCounter();
  const env4 = registerGADT(emptyEnv(), buildExprGADT());

  // Incomplete match — missing BoolLit, Eq, If
  const incompleteBranches: MatchBranch[] = [
    {
      pattern: {
        tag: "PConstructor",
        constructor: "IntLit",
        existentials: [],
        subPatterns: [{ tag: "PWildcard" }],
      },
      body: { tag: "ELiteral", value: 0 },
    },
    {
      pattern: {
        tag: "PConstructor",
        constructor: "Add",
        existentials: [],
        subPatterns: [{ tag: "PWildcard" }, { tag: "PWildcard" }],
      },
      body: { tag: "ELiteral", value: 0 },
    },
  ];

  const scrutineeTy = tCon("Expr", [tMeta()]); // Expr a for some a
  const exhaust = checkExhaustiveness(env4, scrutineeTy, incompleteBranches);
  console.log(`Exhaustive: ${exhaust.isExhaustive}`);
  console.log(`Missing constructors: [${exhaust.missingConstructors.join(", ")}]`);
  console.log(`Redundant branches: [${exhaust.redundantBranches.join(", ")}]`);
  console.log();

  // Complete match with wildcard
  const completeBranches: MatchBranch[] = [
    ...incompleteBranches,
    {
      pattern: { tag: "PWildcard" },
      body: { tag: "ELiteral", value: 0 },
    },
  ];
  const exhaust2 = checkExhaustiveness(env4, scrutineeTy, completeBranches);
  console.log(`With wildcard — Exhaustive: ${exhaust2.isExhaustive}`);
  console.log();

  // --- Demo 6: Type-safe equality proof ---
  console.log("━━━ Demo 6: Type Equality Witness (Refl) ━━━\n");

  resetIdCounter();
  const env5 = registerGADT(emptyEnv(), buildEqualGADT());

  const reflExpr: Expr = {
    tag: "EConstruct",
    constructor: "Refl",
    typeArgs: [tCon("Int")],
    args: [],
  };

  const reflTy = infer(env5, reflExpr);
  console.log(`Refl @Int : ${prettyType(zonk(reflTy))}`);
  console.log("  → Proves Int ~ Int");
  console.log();

  // --- Demo 7: Demonstrate type error ---
  console.log("━━━ Demo 7: Type Safety — Detecting Invalid Programs ━━━\n");

  resetIdCounter();
  const env6 = registerGADT(emptyEnv(), buildExprGADT());

  // Try: Add (BoolLit true) (IntLit 1) — should fail because Add expects Expr Int
  const badExpr: Expr = {
    tag: "EConstruct",
    constructor: "Add",
    typeArgs: [],
    args: [
      {
        tag: "EConstruct",
        constructor: "BoolLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: true }],
      },
      {
        tag: "EConstruct",
        constructor: "IntLit",
        typeArgs: [],
        args: [{ tag: "ELiteral", value: 1 }],
      },
    ],
  };

  try {
    infer(env6, badExpr);
    console.log("ERROR: Should have been rejected!");
  } catch (e: any) {
    console.log(`✓ Correctly rejected: Add (BoolLit true) (IntLit 1)`);
    console.log(`  Error: ${e.message}`);
  }
  console.log();

  console.log("━━━ Summary ━━━\n");
  console.log("This system implements full GADTs with:");
  console.log("  • Type-indexed data constructors with return type refinement");
  console.log("  • Existential type variables in constructors");
  console.log("  • Type equality constraints (a ~ b)");
  console.log("  • Pattern matching with local type refinement");
  console.log("  • Unification-based type inference with occurs check");
  console.log("  • Elaboration to System FC-style Core with explicit coercions");
  console.log("  • Exhaustiveness & redundancy checking for GADT patterns");
  console.log("  • Runtime evaluation with coercion erasure");
  console.log("  • Support for type equality witnesses (Leibniz/propositional equality)");
}

demo();
