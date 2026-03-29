# GADT Compiler Glossary

This is a quick reference for terminology used in this repository.

## GADT (Generalized Algebraic Data Type)

A data type where each constructor can return a more specific indexed type, not just the parent type with generic parameters unchanged.

## Surface AST

The source-level syntax tree (`Expr`, `Pattern`, `MatchBranch`) before lowering to Core IR.

## Core IR

The lower-level intermediate representation (`CoreExpr`) used after elaboration. It makes type-level evidence explicit.

## Type Index

A type argument that refines an indexed type, such as `Expr<Int>` where `Int` is the index.

## Refinement

A branch-local type equality learned during pattern matching on a GADT constructor.

## Type Equality

A relation of the form `lhs ~ rhs` used to represent proven equalities in branches and constraints.

## Coercion

Explicit evidence in Core IR that two types are equal (for example `CoAxiom`, `CoRefl`, `CoTrans`).

## Unification

The algorithm that solves type equations by finding compatible substitutions for unknown types.

## Metavariable (Meta)

A temporary unknown type variable introduced during inference (`TypeTag.Meta`) and later solved by unification.

## Occurs Check

A unification safety check that prevents creating infinite recursive types.

## Zonking

Normalizing a type by recursively chasing solved metavariables to their final representative type.
In this codebase, `zonk` also performs path compression on metas for efficiency.

## Rigid Type Variable

A non-instantiable type variable (skolem-like) used to prevent invalid substitutions across scopes.

## Generalization

Converting inferred monotypes into polymorphic schemes (`forall`) at let-bindings when appropriate.

## Instantiation

Replacing `forall`-bound variables with fresh metas when a polymorphic value is used.

## Elaboration

Translation from surface AST to Core IR, including insertion of explicit coercion evidence.

## Exhaustiveness Checking

Analysis that verifies whether match branches cover all inhabitable constructors.

## Redundant Branch

A match branch that can never be selected because previous branches already cover it.

## Type Erasure (Runtime)

Type-level constructs (for example coercions and type lambdas/apps) do not affect runtime value computation.

## Value Environment

Runtime map from variable names to evaluated values (`ValueEnv`).

## Pretty Printer

Functions that render internal structures into readable text (`prettyType`, `prettyCoreExpr`, `prettyValue`).
