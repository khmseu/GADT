---
description: "Use when editing any TypeScript source file in src/. Ensures all files carry consistent, detailed structured comments."
name: "Structured Comment Conventions"
applyTo: "src/*.ts"
---

# Structured Comment Conventions

Every TypeScript file in `src/` must follow these comment rules at all times.
Treat violations the same way you treat a type error: fix them before committing.

---

## 1. File-Level Banner

Every file **must** open with a 60-character `=` ruled banner followed by a
single-line description of the module's sole responsibility, then a closing
ruled line.

```ts
// ============================================================
// <Module name> — <one-line responsibility>
// ============================================================
```

Keep the description to one line. It must name the compiler stage and what
it owns (e.g. "Surface syntax — expressions & patterns").

---

## 2. Stage-Ownership Table

Directly beneath the banner, add a `// Stage:` block that maps this file into
the compiler pipeline. Use exactly this format:

```ts
// Stage  : <stage number and name>
// Input  : <what this module consumes, or "—" if none>
// Output : <what this module produces, or "—" if none>
// Deps   : <comma-separated list of local imports, or "none">
```

Omit any line whose value would be "—" **only** if ALL four values are "—".

---

## 3. Section Dividers

Logical sections within a file must be separated by a full 60-character
`=` ruled line followed immediately by a section heading comment:

```ts
// ============================================================
// <Section heading>
// ============================================================
```

Use section dividers for:

- Exported type definitions
- Internal helpers
- Entry-point / public API functions
- Named sub-algorithms (e.g. "Zonking", "Occurs check")

---

## 4. Interface and Type JSDoc

Every exported `interface`, `type` alias, and `enum` must carry a JSDoc block
(`/** … */`) that states:

1. **Purpose** — one sentence describing what the type models.
2. **Invariants** (if any) — bullets prefixed with `@invariant`.
3. **Related** (if any) — `@see TypeName` for closely related types.

```ts
/**
 * A GADT constructor with its full elaboration signature.
 *
 * @invariant `returnType` must be an application of the parent GADT.
 * @see GADTDeclaration
 */
export interface GADTConstructor { … }
```

---

## 5. Function JSDoc

Every exported function and every non-trivial internal function must carry a
JSDoc block that includes, as applicable:

| Tag                           | Required when                          |
| ----------------------------- | -------------------------------------- |
| One-sentence summary (no tag) | always                                 |
| `@param <name>`               | function has ≥ 1 parameter             |
| `@returns`                    | return type is not `void`              |
| `@throws`                     | function may throw a typed error       |
| `@remarks`                    | implementation strategy is non-obvious |

```ts
/**
 * Unify two types, mutating metavariable bindings in place.
 *
 * @param lhs - Left-hand type to unify.
 * @param rhs - Right-hand type to unify.
 * @throws {UnificationError} when the types are incompatible.
 * @throws {OccursCheckError} when a metavariable would occur in its own solution.
 * @remarks Uses a union-find structure via `ref.contents` path compression.
 */
export function unify(lhs: Type, rhs: Type): void { … }
```

---

## 6. `switch` Branch Comments

Every `switch` on a tagged union must have an inline comment on each `case`
that is not instantly self-evident. Use one line, starting with `//`:

```ts
case TypeTag.Meta:
  // Chase indirections; path-compress for O(α) amortised cost.
  if (ty.ref.contents !== null) { … }
```

Exhaustive `default` / `never` branches must carry a comment explaining the
invariant:

```ts
default: {
  // Unreachable: all TypeTag variants handled above.
  const _: never = ty;
  throw new Error(`zonk: unexpected tag ${(ty as Type).tag}`);
}
```

---

## 7. Inline Step Comments for Multi-Step Algorithms

Any block of ≥ 4 sequential logical steps must be annotated with
step-numbered comments:

```ts
// Step 1: Freshen constructor universals.
const freshened = freshenUniversals(ctor);

// Step 2: Build local refinements from constructor constraints.
const localEqs = buildRefinements(freshened.constraints);

// Step 3: Extend the environment with field bindings.
const extEnv = bindFields(env, freshened.fields, pats);

// Step 4: Infer body type under the refined environment.
const bodyTy = infer(extEnv, branch.body);
```

---

## 8. TODO / FIXME Protocol

If a known limitation or deferred work is left in the code, annotate it with:

```ts
// TODO(<initials>, <ISO date>): <description of what needs doing>
// FIXME(<initials>, <ISO date>): <description of the bug / unsound behaviour>
```

Do **not** leave bare `// TODO` without author and date.

---

## 9. Applying These Rules When Editing

When you add or modify any construct in a `src/*.ts` file:

- Add or update the file banner and stage-ownership block if needed.
- Add JSDoc to any new exported type or function you introduce.
- Add a section divider if you introduce a new logical section.
- Add step comments if your implementation has ≥ 4 sequential steps.
- Remove or update stale comments so they stay accurate.

Do **not** mass-rewrite comments in code you are not otherwise touching.
Only bring the directly affected declarations into compliance.
