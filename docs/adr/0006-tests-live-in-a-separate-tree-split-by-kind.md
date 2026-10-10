# Tests live in a separate tree, split by kind

Tests do not sit next to the code they cover. They live under `test/`, grouped by kind (`unit/`, `integration/`, `contract/`, `e2e/`), and `test/unit/` mirrors the layout of `src/`. This keeps `src/` limited to what ships, gives every kind of test the same convention, and lets each kind run on its own: unit tests take milliseconds, while integration tests need Docker. Tests import production code through the `#src/*` subpath import declared in `package.json` instead of long relative paths. The alias is for tests only: code under `src/` keeps relative imports, because the alias points at the TypeScript sources, which do not exist in `dist/`.

## Considered Options

- **Colocated tests (`*.test.ts` beside the source)**: the usual convention with Vite and easier to find, but it mixes test and production code and still leaves integration and e2e tests elsewhere.
- **`paths` in `tsconfig.json`**: only TypeScript understands it, so Vitest would need the same alias configured again.

## Consequences

Moving a file in `src/` means moving its unit test by hand. Tests that pin known outputs of the Short Code permutation (ADR-0004) must never be updated to match new values: a failure there means the permutation changed.
