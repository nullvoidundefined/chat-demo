# ESLint Fix Report

## Root Cause

`eslint-config-next` v16 ships as a **flat config array** -- not a legacy sharable config. The original `eslint.config.mjs` passed it to `FlatCompat.extends()`, which is designed to wrap old-style `.eslintrc` configs. During FlatCompat's internal processing it calls `JSON.stringify` on the plugin registry to validate it. `eslint-plugin-react` v7 exposes a `configs.flat` property where each entry contains `plugins: { react: <the plugin> }`, which references back to itself through `configs.flat` -- an inherent circular structure. This caused the crash.

Extending the `.filter()` to also drop configs with `react` or `jsx-a11y` plugins did not help because the crash occurs inside FlatCompat's validation pass before the filter runs.

## Fix Approach: Rebuild Without FlatCompat

Dropped `FlatCompat` and its `@eslint/eslintrc` dependency entirely. Imported `eslint-config-next/core-web-vitals` directly as an ES module and spread it into the config array. That config is already a flat array providing: `react`, `react-hooks`, `jsx-a11y`, `import`, `@next/next`, and `@typescript-eslint` plugins along with all Next.js rules.

The explicit `plugins: { react, 'react-hooks', 'jsx-a11y' }` block was removed from the TypeScript config object to prevent double-registration. ESLint 9 flat config requires that any plugin registered in more than one config block must use the exact same object reference; Next bundles different instances of `react-hooks` and `jsx-a11y` than the project-level installs, so re-registering them would cause a conflicting-plugin-definitions error. The plugin-namespaced rules (`jsx-a11y/*`, `react/*`, `react-hooks/*`) continue to work because the plugins are already registered in the nextCoreWebVitals config objects.

## Changes

### `eslint.config.mjs`

- Removed `FlatCompat`, `tsEslintParser`, and explicit `react`, `reactHooks`, `jsxA11y` imports
- Replaced `compat.extends('next/core-web-vitals', 'next/typescript')` with `import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'` spread directly
- Removed `plugins: { 'jsx-a11y': jsxA11y, react, 'react-hooks': reactHooks }` from TypeScript config block
- Removed `languageOptions.parser` override from TypeScript block (Next's config sets the parser)
- Kept all rules unchanged including `react/forbid-dom-props`, all `jsx-a11y/*` overrides, all `@typescript-eslint/*` rules, `security`, `unused-imports`, and `eslintConfigPrettier`

### `src/services/agent/runResearchAgent.ts` (line 112)

Fixed one legitimate `@typescript-eslint/no-unsafe-assignment` warning: typed `JSON.parse(content)` result as `unknown` instead of leaving it as `any`.

## Plugins / Rules Dropped

None. All plugins and rules from the original config are preserved.

## Final Result

```
npx eslint .
(no output -- zero findings, zero errors)

npx tsc --noEmit
(no output -- zero type errors)
```
