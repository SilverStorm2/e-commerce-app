# e-commerce-app

[![CI](https://github.com/SilverStorm2/e-commerce-app/actions/workflows/ci.yml/badge.svg)](https://github.com/SilverStorm2/e-commerce-app/actions/workflows/ci.yml)

Community-centric multi-vendor marketplace MVP built with Next.js App Router, Supabase, Tailwind v4, and shadcn/ui. The project emphasises strict RLS-backed data access, multi-seller checkout, PL/EN localisation, and baseline security guardrails.

## Getting Started

```bash
npm install
npm run dev
```

Visit `http://localhost:3000/pl` or `http://localhost:3000/en` to see the storefront shell.

## Quality Gates

- `npm run lint` – ESLint via Next.js with warnings treated as errors.
- `npm run lint:fix` – auto-fixable ESLint issues.
- `npm run format` / `npm run format:write` – Prettier validation or rewrite.
- `npm run typecheck` – TypeScript project-wide compilation in `--noEmit` mode.
- `npm run test` – Vitest unit and integration suites (uses jsdom).

## Commit Hooks

Running `npm install` will automatically point Git hooks to `.husky`. The pre-commit hook runs `npm run lint:staged`, formatting and linting staged files before allowing the commit.

If hooks are ever missing, execute:

```bash
npm run prepare
```

## Continuous Integration

GitHub Actions workflow `ci.yml` (stored in `.github/workflows`) runs linting, formatting, type checks, and tests on every push and pull request. Keep the main branch green to satisfy M0 guardrail requirements.
