# TypeScript 7 with the Oxc toolchain

The project compiles and type-checks with TypeScript 7, the native compiler. typescript-eslint does not support TypeScript 7, so ESLint is not used: linting is done by oxlint, with oxlint-tsgolint providing type-aware rules on top of typescript-go, and formatting by oxfmt. Vitest runs on Vite, which also strips types with Oxc, so one toolchain covers linting, formatting and test transforms, while `tsc` remains the only type checker.

## Considered Options

- **TypeScript 6 with ESLint, typescript-eslint and Prettier**: the most mature setup with the largest plugin ecosystem, but it ties the project to the old compiler.
- **Biome**: a single fast tool for linting and formatting, but its type-aware rules rely on its own type inference rather than the TypeScript compiler.

## Consequences

Fewer lint rules and plugins are available than with ESLint, and the tools are young, so upgrades need care. oxfmt is pinned to an exact version because it is still 0.x and its output may change between releases.
