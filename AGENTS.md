# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router application for the Special Risk Allowance Workflow. Route pages, layouts, API routes, and server actions live in `app/`; reusable React components live in `components/`, with shadcn-style primitives in `components/ui/`. Core application code is under `lib/`: `lib/domains/*` contains repository-service domain modules, `lib/auth` handles authentication, `lib/db` wraps Prisma, and `lib/shared` holds shared types and helpers. Prisma schema, migrations, and seed logic are in `prisma/`. Static files, service worker assets, manifest, SVGs, and fonts are in `public/`. Treat `graphify-out/`, `.next/`, and generated Prisma output as derived artifacts.

## Build, Test, and Development Commands

Use Bun, matching `packageManager` in `package.json`.

- `bun install`: install dependencies from `bun.lock`.
- `bun dev`: run the local Next.js dev server.
- `bun devh`: run dev server with experimental HTTPS on `local.sraw.space`.
- `bun run build`: create a production Next.js build.
- `bun run start`: serve the built app.
- `bun run lint`: run ESLint using Next.js core-web-vitals and TypeScript rules.
- `bunx prisma generate`: regenerate Prisma client after schema changes.
- `bunx prisma migrate dev --name <name>`: create and apply a local migration.
- `bunx prisma studio`: inspect local data.

## Coding Style & Naming Conventions

Write TypeScript with `strict` mode in mind and import through the `@/*` alias when it improves clarity. Follow existing two-space indentation, double quotes, and semicolon style. Name route folders and domain folders with kebab-case, React components with PascalCase, hooks with `use-*`, and service/repository files as `service.ts` and `repository.ts`. Application code should call domain services, not repositories directly; keep database queries in repositories and business rules in services. Service methods should return and handle the shared `Result<T>` pattern.

## Testing Guidelines

No automated test framework is currently configured. Before opening a PR, at minimum run `bun run lint` and `bun run build`. For risky changes, add focused tests alongside the changed feature once a test runner is introduced, using names like `<feature>.test.ts` or `<component>.test.tsx`. Manually verify affected user flows, especially server actions, Prisma migrations, notifications, signatures, and print pages.

## Commit & Pull Request Guidelines

Git history includes Conventional Commit prefixes such as `feat:` and `chore:`; prefer `type: concise summary` and avoid vague messages. PRs should include a short description, linked issue or task, screenshots for UI changes, migration notes for Prisma changes, and the commands you ran. Never commit secrets from `.env`, private certificates, or production credentials.
