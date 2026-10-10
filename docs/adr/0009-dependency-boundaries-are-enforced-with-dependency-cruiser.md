# Dependency boundaries are enforced with dependency-cruiser

The architecture depends on a few import rules: a module's domain imports only its own domain and `shared/domain`, with no packages or Node APIs; its application layer adds only its own application layer; `infrastructure/` and `http/` do not import each other; `shared/` never imports `modules/`; a module reaches another module only through its `index.ts`; and only `entrypoints/` may import anything. Reviews alone do not keep such rules, so `pnpm check` runs dependency-cruiser over `src/` and fails on any violation. The rules capture the module name, so they apply to every future module without changes. Tests are not checked: they import internals through `#src` on purpose (ADR-0006).

dependency-cruiser parses TypeScript through the `typescript` package, whose JavaScript API is not available in TypeScript 7 (ADR-0007). Without it, `.ts` files are skipped and the check passes with nothing analysed. The project uses dependency-cruiser's swc parser instead, with type-only imports counted, so a domain file cannot import a type from an outer layer unnoticed.

## Considered Options

- **oxlint's `no-restricted-imports`**, with patterns per folder: no extra dependency, but it matches the import text rather than the resolved file. Layer rules work, but a relative import into another module (`../../other/domain/x.js`) cannot be told apart reliably, so the module boundary would go unchecked.
- **ArchUnitTS, ts-arch or Sheriff**: they rely on the TypeScript compiler API, so they do not work with TypeScript 7.
- **eslint-plugin-boundaries**: needs ESLint, which the project does not use (ADR-0007).

## Consequences

`@swc/core` is an extra dev dependency, and every run prints a `missing-typescript-transpiler` warning that does not affect the result. Once dependency-cruiser supports TypeScript 7, the swc parser and the warning go away. The checks also catch circular imports, unresolvable imports and devDependencies imported from `src/`.
