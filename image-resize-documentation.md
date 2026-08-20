# simple-image-resize Architecture

This plugin detects a single image embed in Joplin's Markdown editor, gathers the image's dimensions, lets the user choose resize options, and replaces the original embed in-place.

## Request Flow

1. Detect the image at the current editor cursor position.
2. Resolve original image dimensions using the best available platform-specific strategy.
3. Show the resize dialog and collect target syntax, size, alt text, and title.
4. Build the new Markdown or HTML image syntax.
5. Replace the original embed in the editor and show feedback.

## Main Pieces

### Plugin Shell

- `src/index.ts` boots the plugin, registers settings, commands, menus, toolbar integration, and the CodeMirror content script.
- `src/settings.ts` defines plugin settings and exposes cached configuration.
- `src/menus.ts` wires the command surface into Joplin menus, toolbar, and context menu behavior.
- `src/quickResizeOptions.ts` parses and normalizes the configurable quick resize slot setting, then converts slots into resize requests.

### Detection and Editor Operations

- `src/contentScripts/cursorContentScript.ts` runs inside the CodeMirror editor context.
- It is the source of truth for cursor-based image detection, editor text replacement, dimension lookup in editor context, and editor-origin context menu checks.
- Detection is syntax-tree based, not regex-first. It recognizes Markdown image nodes plus HTML `img` tags, including nested HTML blocks.
- `src/imageSyntaxParser.ts` owns the lightweight regex extraction that pulls source, alt text, and title from syntax-tree-validated image nodes.
- Leading indentation on an image line can be treated as part of the activation area, while replacement still targets only the image syntax itself.
- `src/cursorDetection.ts` is the thin plugin-side wrapper around these content script commands.
- The detection and document-mutation logic is split from the Joplin/CodeMirror wiring: `findImagesOnLine`, `getImageAtCursor`, `isCursorInImageActivationRange`, `posToOffset`, and `resolveReplaceChange` are named exports that take an `EditorState` or `Text` instead of an `EditorView`. Only the registered command handlers in the default export need the view (for `dispatch` and DOM events). Tests build a real `EditorState` with `@codemirror/lang-markdown` and drive these directly.

### Resize Pipeline

- `src/imageSizeCalculator.ts` resolves dimensions using layered strategies so the plugin works across desktop, Android, and the web app. It owns fallback-dimension policy for both resource and external images; an invalid resource ID is still rejected outright, while a non-http(s) external source (relative path, `data:` URI) falls back to default dimensions so the resize dialog still opens. Resource bytes from the Data API are normalized into a `Uint8Array`, wrapped in a `Blob`, and measured through a temporary object URL without base64 conversion. External images are loaded without a referrer and without requiring CORS, since only their intrinsic dimensions are read.
- `src/dialogHandler.ts` builds and runs the resize dialog.
- `src/dialogLock.ts` prevents overlapping dialogs.
- `src/imageSyntaxBuilder.ts` converts dialog choices into final Markdown or HTML output.
- Quick resize commands use five stable command slots with default values `100%, 75%, 50%, 33%, 25%`.

### Shared Utilities

- `src/utils/imageDimensionUtils.ts` contains shared DOM image measurement logic and the image load timeouts, kept runtime dependency-free so both execution contexts can import them.
- `src/utils/resourceUtils.ts` handles resource-specific helpers.
- `src/utils/stringUtils.ts` handles HTML entity decoding and output escaping.
- `src/utils/toastUtils.ts` centralizes toast messaging.
- `src/logger.ts` and `src/types.ts` provide logging and core types.

## Detection Model

The architecture separates image detection from image extraction:

- Detection uses CodeMirror's syntax tree so the plugin can reason about real Markdown and HTML structure instead of raw text alone.
- Extraction uses focused regex patterns only after a syntax node has already been identified as an image.

That split keeps detection reliable while keeping the extraction code small and easy to maintain.

## Platform Strategy

The same high-level flow is used on desktop, Android, and the web app, but dimension lookup adapts to platform capabilities:

- Prefer editor-context access when available.
- Fall back to Blob object URL loading when resource bytes are available, always revoking the temporary URL after measurement.
- Fall back again to default dimensions if lookup fails.

This keeps the user-facing behavior consistent without forcing the rest of the plugin to care about platform differences.

## Output Rules

- Markdown output preserves standard Markdown image syntax and does not encode explicit size.
- HTML output is used for resized images and can emit width only or width plus height, depending on settings. When original dimensions cannot be determined, HTML output always emits width only so the browser can preserve the image's natural aspect ratio.
- When original dimensions could not be determined, the resize dialog shows that status instead of the fallback dimensions, disables percentage resizing, selects absolute sizing, and disables the height field.
- Alt text and title are preserved across conversions, with escaping rules handled centrally in the string utilities.

## Quick Resize Slots

Quick resize options are configured through a comma-separated setting. Each option must be a positive whole-number percentage from `1%` through `500%` or a positive whole-number pixel width such as `300px`.

The plugin supports one to five configured quick resize slots. The default slots are `100%, 75%, 50%, 33%, 25%`, mapped to `CmdOrCtrl+Shift+1` through `CmdOrCtrl+Shift+5`. The command IDs remain stable for compatibility, while each command reads the current setting at execution time. A `100%` slot converts the image back to Markdown syntax to remove custom sizing; other percentage and pixel slots emit HTML image syntax.

Scaling percentage slots need the image's original dimensions, so they are skipped with an explanatory toast when those dimensions could not be determined. The `100%` slot and pixel slots stay available, since neither derives a size from the original dimensions.

When settings load or change, recoverable quick resize setting errors are normalized before commands or menus use them. Invalid entries are dropped, entries beyond the five-slot limit are removed, valid entries are canonicalized, and an empty or fully invalid list is reset to the default slots.

## Design Intent

The project is organized around a few boundaries:

- Editor-specific logic lives in the content script.
- Plugin orchestration stays in the main plugin context.
- Image syntax extraction lives in a pure parser module shared with its tests.
- Inside the content script, parsing and range resolution are view-independent functions; the view is only touched at the command boundary. That keeps the code that mutates a user's note unit-testable.
- Syntax generation is separate from detection.
- Platform-specific dimension lookup is isolated behind a shared calculator.

The result is a small pipeline: detect, measure, prompt, build, replace.
