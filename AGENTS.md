# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Deno Desktop application with a Preact/Vite frontend.

- `desktop.ts` serves the built UI and implements desktop-only file and settings APIs.
- `cli.ts` is the globally installable `reviwers` launcher.
- `src/app/` contains the Preact interface and CSS; `src/domain/` holds reusable TypeScript logic.
- `main_test.ts` contains Deno tests for domain behavior.
- `assets/` stores application icons, while `docs/images/` stores documentation screenshots.
- `dist/` and `build/` are generated outputs and should not be committed.

Keep UI rendering code in `src/app`, and move parsing or other independently testable behavior into `src/domain`.

## Build, Test, and Development Commands

- `deno task dev`: start the Vite development server on port 8000.
- `deno task build`: create the production frontend in `dist/`.
- `deno task desktop`: generate the macOS icon, build the UI, and launch the CEF desktop app.
- `deno task desktop:hmr`: run Deno Desktop with hot module replacement.
- `deno task preview`: preview the production Vite build locally.
- `deno test`: run all Deno tests.
- `deno fmt --check`: verify standard Deno formatting before submitting changes.

Deno 2.9.0 or later is required. Dependencies are pinned in `deno.json`; do not maintain a separate npm lockfile.

## Coding Style & Naming Conventions

Use Deno's default formatter and two-space indentation. Prefer TypeScript for domain, CLI, and desktop code; the current Preact UI uses JavaScript without JSX. Use `camelCase` for variables and functions, `PascalCase` for components and interfaces, and descriptive kebab-case CSS classes such as `preview-panel`. Keep functions focused and use explicit types at module boundaries.

## Testing Guidelines

Tests use `Deno.test` with `@std/assert`. Name tests by observable behavior, for example `extracts multiple mermaid fenced blocks`. Add tests when changing parsing, path resolution, settings normalization, or other non-visual behavior. Place focused module tests beside the existing root suite or in files ending `_test.ts`.

## Commit & Pull Request Guidelines

History uses short, direct subjects such as `update` and `fileinputの調整`. Prefer a more descriptive imperative subject (for example, `Handle markdown files without Mermaid blocks`) and keep each commit scoped to one concern. Pull requests should explain the user-visible change, list verification commands, and link relevant issues. Include before/after screenshots for interface or styling changes, and note any macOS/CEF-specific testing.
