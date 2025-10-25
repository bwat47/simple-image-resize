# Repository Guidelines

## Project Documentation

image-resize-documentation.md

- Keep up to date with architecture changes
- Keep concise, file is meant for LLM consumption

## Project Structure & Module Organization

- `src/` TypeScript sources for the Joplin plugin.
    - `index.ts` Main plugin entry point; keep lean (registration, commands, settings only).
    - `dialogHandler.ts` Modal dialog with CSS controls and form handling.
    - `imageDetection.ts` Smart syntax detection for Markdown/HTML images.
    - `imageSizeCalculator.ts` Dimension extraction via Imaging API with fallbacks.
    - `imageSyntaxBuilder.ts` Output generation with proper escaping/encoding.
    - `cursorDetection.ts` Editor cursor position and range detection.
    - `selectionValidation.ts` Multi-image validation and selection helpers.
    - `stringUtils.ts` HTML/Markdown escaping and entity decoding.
    - `utils.ts` Joplin-specific utilities (resource validation, base64 conversion).
    - `constants.ts` Regex patterns, settings keys, timeouts.
    - `types.ts` TypeScript interfaces and type definitions.
    - `manifest.json` Plugin metadata; sync when adding features or settings.
- Tests live alongside sources as `*.test.ts` files.
- `publish/` Build artifacts (`*.jpl`) created by the dist task.
- `api/` Joplin API type definitions (read-only).

## Build, Test, and Development Commands

- `npm test` Run Jest test suite with coverage.
- `npm run test:watch` Run tests in watch mode during development.
- `npm run dist` Build plugin and create archive at `publish/*.jpl`.
- `npm run lint` Lint TypeScript with ESLint.
- `npm run lint:fix` Auto-fix lint issues.
- `npm run format` Format code with Prettier.
- `npm run updateVersion` Sync plugin version metadata.

Use Node LTS (18+) and npm 9+ for consistency.

## Design Principles

- **Simple over complex:** prefer focused, single-responsibility modules.
- **One clear way**: Single detection/validation path; avoid multiple competing approaches.
- **Separation of concerns**: Each module handles one aspect (detection, sizing, building, etc.).
- **Fail fast**: Validate inputs early; provide clear error messages to users.
- **Preserve user data**: Never lose alt text, titles, or formatting during conversions.

## Coding Style & Naming Conventions

- **Language**: TypeScript with strict settings; 4-space indentation; semicolons required.
- **Filenames**: `camelCase.ts` for modules; tests mirror names: `module.test.ts`.
- **Exports**: Prefer explicit types and narrow public exports.
- **Error handling**: Use consistent logging prefix `[Image Resize]` or `[image-resize]`.
- **Style enforcement**: Run `eslint.config.js`, `.prettierrc.js` before commits.
- **Documentation**: Use JSDoc for complex functions; document regex patterns with examples.

## Image Detection & Processing

- **Regex patterns**: Centralize in `constants.ts` with clear comments and examples.
- **Multi-format support**: Handle both Markdown (`![](...)`) and HTML (`<img ...>`) syntax.
- **External URLs**: Support `http(s)://` alongside Joplin resources (`:/resourceId`).
- **Escaping strategy**:
    - Decode HTML entities on input (dialog display, Markdown output).
    - Escape properly on output (HTML attributes, Markdown titles).
- **Dimension detection**: Primary via Imaging API; fallback to DOM `Image` with timeouts.

## Dialog & User Experience

- **CSS-first approach**: Use hidden radio buttons + CSS selectors for field enable/disable.
- **Responsive design**: Support 480px to 4K+ screens with appropriate breakpoints.
- **User preferences**: Remember default resize mode; pre-populate based on settings.
- **Context-aware**: Only show resize option when cursor is on/in an image embed.
- **Toast feedback**: Provide clear success/error messages for all operations.

## TypeScript & Error Handling

- **Strict typing**: Avoid `any`; prefer `unknown` then narrow with type guards.
- **Interface design**: Define comprehensive interfaces in `types.ts`.
- **Error boundaries**: Catch at appropriate levels; don't let exceptions crash the plugin.
- **Graceful degradation**: Provide fallbacks for external images, network failures.
- **Validation helpers**: Use dedicated functions for resource IDs, URLs, dimensions.

## Settings & Configuration

- **Centralized constants**: Define setting keys in `constants.ts` to avoid typos.
- **Sane defaults**: Provide working defaults; validate user settings on load.
- **Manifest sync**: Keep `manifest.json` settings in sync with TypeScript registration.
- **User preferences**: Respect user choices (default resize mode, syntax preference).

## Testing Guidelines

- **Framework**: Jest with `ts-jest` for TypeScript support.
- **Test placement**: `src/module.test.ts` alongside source files.
- **Coverage areas**: Focus on detection logic, syntax building, validation helpers.
- **Mock strategy**: Mock Joplin APIs; use fixtures for test data.
- **Deterministic tests**: Avoid timing dependencies; use consistent test data.

## Security & Data Handling

- **Input validation**: Always validate resource IDs, URLs, and user inputs.
- **Output escaping**: Properly escape HTML attributes and Markdown titles.
- **External image privacy**: Use `crossOrigin='anonymous'` and `referrerPolicy='no-referrer'`.
- **Resource cleanup**: Always free Imaging API handles in `finally` blocks.
- **No data loss**: Preserve alt text, titles, and whitespace during transformations.

## Commit & Pull Request Guidelines

- **Commit messages**: Clear, present-tense (e.g., "Add external image dimension detection").
- **Scope**: One feature/fix per commit; reference issues when applicable.
- **PR requirements**: Include description, testing steps, screenshots for UI changes.
- **Documentation**: Update `README.md` for user-facing changes; maintain `image-resize-documentation.md`.
- **Testing**: Verify in actual Joplin instance; test both resource and external images.

## Plugin Integration Guidelines

- **Editor compatibility**: Target Markdown editor; gracefully handle rich text contexts.
- **Command registration**: Use clear names and appropriate when-clauses.
- **Context menu**: Dynamically show/hide based on cursor position and editor type.
- **Settings integration**: Use Joplin's settings API; provide user-friendly labels and descriptions.
- **Performance**: Minimize blocking operations; use timeouts for external resources.
