---
name: jotai
description: Build, review, refactor, and debug React state management with Jotai. Use this whenever user mentions Jotai, atoms, atom families, Provider/store setup, derived atoms, async atoms with Suspense, SSR hydration, persistent atom storage, resettable/select/split utilities, or asks to migrate from useState/Context/Redux/Zustand to Jotai patterns.
---

# Jotai skill

Use this skill to produce practical Jotai guidance and code grounded in bundled
docs.

## What to do first

1. Identify task type: new feature, bug fix, migration, architecture, or
   performance.
2. Map user problem to atom model:
   - Primitive atom for source state.
   - Derived read atom for computed state.
   - Writable derived atom for multi-atom updates.
3. Choose scope for store:
   - Provider-less default store for simple/global usage.
   - `Provider` (optionally with `createStore`) for subtree isolation, tests,
     SSR, or reset-by-remount.
4. Pick utilities only when they reduce complexity (`atomFamily`, `selectAtom`,
   `splitAtom`, `atomWithStorage`, `atomWithReset`, etc.).

## Ground rules

- Keep atom references stable. If atom created in render, memoize with `useMemo`
  or `useRef`.
- Separate read and write concerns; avoid monolithic write functions when
  smaller atoms are clearer.
- Prefer narrow subscriptions (`useAtomValue`, `useSetAtom`, `selectAtom`) to
  limit rerenders.
- For async atoms, account for Suspense behavior and cancellation
  (`options.signal` where relevant).
- Preserve TypeScript inference; avoid unnecessary casts.

## Output format

When user asks for implementation or fix, respond in this structure:

1. **Plan**: 2-4 concrete steps.
2. **Code**: complete snippets/diffs with atom definitions + component usage.
3. **Why this design**: short explanation tied to Jotai behavior (dependency
   tracking, store boundaries, rerender profile).
4. **Pitfalls checklist**: only relevant gotchas for that case.

## Pattern playbook

### Core atoms

- Primitive: `const countAtom = atom(0)`
- Read derived: `const doubledAtom = atom((get) => get(countAtom) * 2)`
- Writable derived for coordinated updates:

```ts
const priceAtom = atom(100);
const discountAtom = atom(0);
const finalPriceAtom = atom(
  (get) => get(priceAtom) - get(discountAtom),
  (get, set, discount: number) => {
    set(discountAtom, discount);
  },
);
```

### Store and Provider choices

- Use `<Provider>` to isolate state by subtree.
- Use `createStore()` when imperative `get/set/sub` or custom store lifecycle
  needed.
- Use `getDefaultStore()` only for controlled provider-less scenarios.

### Utility selection guide

- `atomFamily`: parameterized atoms by id/key.
- `selectAtom`: derive slices to cut rerenders.
- `splitAtom`: manage per-item atoms from list atom.
- `atomWithStorage`: persist state to storage.
- `atomWithReset` / `useResetAtom`: resettable defaults.
- `atomWithReducer`: reducer style transitions.
- `atomWithCallback`: run imperative reads/writes outside render flow.
- `loadable` / async utility atoms: explicit loading/error state when
  Suspense-only UX not desired.

## References

Use these bundled docs as source of truth:

- `references/basics-concepts.mdx`
- `references/core/atom.mdx`
- `references/core/use-atom.mdx`
- `references/core/store.mdx`
- `references/core/provider.mdx`
- `references/utilities/*.mdx`
