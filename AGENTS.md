## Project Documentation

image-resize-documentation.md

- Internal documentation about project architecture, intended for LLMs to reference for context
- Keep up to date with architecture changes when applicable

## Build, Test, and Development Commands

Build, packaging, version, and API-update behavior lives in the shared `@bwat47/joplin-plugin-scripts`
dev dependency. Change it there and update the dependency, rather than adding local build scripts. Extra
content scripts and webview scripts are declared in `plugin.config.json`.

- `npm test` Run the Vitest suite (`tests/**/*.{test,spec}.ts`).
- `npm run test:watch` Run tests in watch mode during development.
- `npm run dist` Typecheck, bundle with esbuild, and create archive at `publish/*.jpl`.
- `npm run typecheck` Check TypeScript without producing output.
- `npm run lint` Lint sources and tests with Oxlint (type-aware), then run the fallow dead-code and complexity checks.
- `npm run lint:dead-code` Find unused files, exports, and dependencies with fallow (`.fallowrc.json`).
- `npm run lint:complexity` Check cognitive/cyclomatic complexity limits with fallow (`health` in `.fallowrc.json`).
- `npm run lint:fix` Auto-fix lint issues.
- `npm run format` Format code with Oxfmt.
- `npm run format:check` Check formatting without writing files.
- `npm run updateVersion` Increment the patch version in package.json, src/manifest.json, and package-lock.json (their versions must already match).
- `npm run updateApi` Replace `api/` with the latest `generator-joplin` API types; review `git diff api/` and run `npm run typecheck` afterwards.

Before releasing, install the `.jpl` in Joplin on desktop and mobile. Check the resize dialog, quick resize, and
resizing from both the editor and the note viewer context menu.

## Design Principles

- **Simple over complex:** prefer focused, single-responsibility modules.
- **One clear way**: Single detection/validation path; avoid multiple competing approaches.
- **Separation of concerns**: Each module handles one aspect.
- **Fail fast**: Validate inputs early; provide clear error messages to users.

## Coding Style & Naming Conventions

- **Language**: TypeScript with strict settings; 4-space indentation; semicolons required.
- **Filenames**: `camelCase.ts` for modules; tests mirror names: `module.test.ts`.
- **Module Boundaries**: Add explicit return types to exported functions and public methods of exported classes. Prefer named exported types for non-trivial object shapes. Let TypeScript infer local implementation details, and avoid redundant primitive annotations.
- **Style enforcement**: Run `npm run format` before commits or if you encounter formatting errors from oxfmt.
- **Documentation**: Use JSDoc for complex functions; document regex patterns with examples.

## Line endings

- All text files use LF. If you must fall back to a Python script for file editing, write LF explicitly
  (Python: `open(path, 'w', newline='\n')` or `write_text(..., newline='\n')`).
- Don't manually repair incidental CRLF changes. Git normalizes text to LF when staging; Oxfmt also normalizes files when formatting.

## Log messages

- Use `src/shared/logger.ts` wrapper

## Git

- Use conventional commit format for commit messages
- Never run git commit proactively; always wait for explicit user consent.
- GitHub credentials are stored in the OS keyring. If `gh auth status` fails inside the sandbox, retry it with escalated permissions before asking me to authenticate.
