# Repository Guidelines

## Project Structure & Module Organization

- `src/app`: Next.js 16 app router pages and API routes (`api/keywords`, `api/content-brief`, `api/keywords/related`).
- `src/components`: UI modules (tables, modals, trend sparkline) used across pages.
- `src/lib`: Service layer (API providers, SERP service, cache, rate limits, config, validation, logging).
- `src/types`: Shared type definitions.
- `tests`: Vitest suites (`unit`, `integration`, `config-validation`, `quality-automation`, `smoke`, `command-execution`) plus Playwright e2e in `tests/e2e`. Use `tests/setup.ts` for helpers.
- `scripts`: Dev utilities (e.g., `scripts/dev-redis.sh` for local Redis).
- `.env.example`: Copy to `.env.local` for required settings (API keys, Redis/Sentry).

## Build, Test, and Development Commands

- Install: `npm install` (Node 20+; Volta pinned to 20.11.1/ npm 10.2.4).
- Develop: `npm run dev` (Next dev server).
- Build/serve: `npm run build` then `npm start`.
- Redis (Docker): `npm run redis:start` / `redis:stop` / `redis:clean` for local rate-limit/cache parity.
- Tests (Vitest): `npm test` (all), `npm run test:unit`, `test:integration`, `test:smoke`, `test:config`, `test:quality`, `test:commands`, `test:coverage`.
- E2E (Playwright): `npm run test:e2e` (add `:ui`, `:headed`, `:debug` as needed).
- Lint/format/type-check: `npm run lint`, `format:check`, `type-check:all`; auto-fix with `lint:fix` and `format`.
- Quality bundle: `npm run quality:ci` (type-check, lint, tests, audit).

## Coding Style & Naming Conventions

- TypeScript-first; keep components functional with hooks; prefer composition over deep prop drilling.
- Files and routes use kebab-case (`trend-sparkline.tsx`); types/interfaces PascalCase.
- 2-space indentation; run Prettier for formatting and ESLint/Stylelint for TS/JS/CSS. Pre-commit hooks via Husky and `lint-staged` mirror CI checks.
- Logging via `src/lib/utils/logger.ts` (pino); avoid `console.log` in committed code.

## Testing Guidelines

- Frameworks: Vitest + Testing Library for unit/integration; Playwright for e2e; happy-dom for DOM tests.
- Place specs under matching `tests/<suite>` folders; name files `*.test.ts`.
- Aim to cover new service code (API providers, cache, validation) with unit tests and add integration coverage for external-facing routes. Keep fixtures deterministic; mock networked providers.
- Run `npm run test:coverage` or relevant suite before PRs; include `type-check:all` for TS safety.

## Commit & Pull Request Guidelines

- Commit style follows Conventional Commits seen in history (`feat:`, `fix:`, `ci:`, `test:`). Scope with short imperative summaries.
- PRs: describe the change, list key commands run, and link issues. Add screenshots for UI changes (before/after). Include notes on env/config updates when `.env.example` changes.
- Ensure lint/tests/quality commands pass locally; update docs (`README.md`, `BACKLOG.md`, `AGENTS.md`) when behavior or expectations change.

## Security & Configuration Tips

- Keep secrets out of the repo; rely on `.env.local` and check `.env.example` for required keys. Use `npm run security:audit` before releases and `validate:all` for a comprehensive sweep.
- Sentry is enabled (client/edge/server configs in root). If adding new routes, ensure errors go through the centralized logger and respect rate-limit/cache helpers in `src/lib`.
