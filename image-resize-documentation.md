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
- Once a node is validated as an image, lightweight regex extraction pulls out source, alt text, and title.
- Leading indentation on an image line can be treated as part of the activation area, while replacement still targets only the image syntax itself.
- `src/cursorDetection.ts` is the thin plugin-side wrapper around these content script commands.

### Resize Pipeline

- `src/imageSizeCalculator.ts` resolves dimensions using layered strategies so the plugin works across desktop, Android, and the web app.
- `src/dialogHandler.ts` builds and runs the resize dialog.
- `src/dialogLock.ts` prevents overlapping dialogs.
- `src/imageSyntaxBuilder.ts` converts dialog choices into final Markdown or HTML output.
- Quick resize commands use five stable command slots with default values `100%, 75%, 50%, 33%, 25%`.

### Shared Utilities

- `src/utils/imageDimensionUtils.ts` contains shared DOM image measurement logic.
- `src/utils/resourceUtils.ts` handles resource-specific helpers.
- `src/utils/stringUtils.ts` handles HTML entity decoding and output escaping.
- `src/utils/toastUtils.ts` centralizes toast messaging.
- `src/logger.ts`, `src/constants.ts`, and `src/types.ts` provide logging, shared constants, and core types.

## Detection Model

The architecture separates image detection from image extraction:

- Detection uses CodeMirror's syntax tree so the plugin can reason about real Markdown and HTML structure instead of raw text alone.
- Extraction uses focused regex patterns only after a syntax node has already been identified as an image.

That split keeps detection reliable while keeping the extraction code small and easy to maintain.

## Platform Strategy

The same high-level flow is used on desktop, Android, and the web app, but dimension lookup adapts to platform capabilities:

- Prefer editor-context access when available.
- Fall back to base64-based loading when needed.
- Fall back again to default dimensions if lookup fails.

This keeps the user-facing behavior consistent without forcing the rest of the plugin to care about platform differences.

## Output Rules

- Markdown output preserves standard Markdown image syntax and does not encode explicit size.
- HTML output is used for resized images and can emit width only or width plus height, depending on settings.
- Alt text and title are preserved across conversions, with escaping rules handled centrally in the string utilities.

## Quick Resize Slots

Quick resize options are configured through a comma-separated setting. Each option must be a positive whole-number percentage from `1%` through `500%` or a positive whole-number pixel width such as `300px`.

The plugin supports one to five configured quick resize slots. The default slots are `100%, 75%, 50%, 33%, 25%`, mapped to `CmdOrCtrl+Shift+1` through `CmdOrCtrl+Shift+5`. The command IDs remain stable for compatibility, while each command reads the current setting at execution time. A `100%` slot converts the image back to Markdown syntax to remove custom sizing; other percentage and pixel slots emit HTML image syntax.

When settings load or change, recoverable quick resize setting errors are normalized before commands or menus use them. Invalid entries are dropped, entries beyond the five-slot limit are removed, valid entries are canonicalized, and an empty or fully invalid list is reset to the default slots.

## Design Intent

The project is organized around a few boundaries:

- Editor-specific logic lives in the content script.
- Plugin orchestration stays in the main plugin context.
- Syntax generation is separate from detection.
- Platform-specific dimension lookup is isolated behind a shared calculator.

The result is a small pipeline: detect, measure, prompt, build, replace.
