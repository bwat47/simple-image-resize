# simple-image-resize Architecture

This plugin detects a single image embed in Joplin's Markdown editor, gathers the image's dimensions, lets the user choose resize options, and replaces the original embed in-place.

## Request Flow

1. Detect the image at the current editor cursor position.
2. Resolve original image dimensions using the best available platform-specific strategy.
3. Show the resize dialog and collect target syntax, size, alt text, and title.
4. Build the new Markdown or HTML image syntax.
5. Replace the original embed in the editor and show feedback.

## Source Layout

Code under `src/` is grouped by the runtime it is bundled into, because that decides what each module may import:

- `src/index.ts` and `src/manifest.json` stay at the root, where Joplin's build expects them.
- `src/host/` runs in the plugin sandbox and is the only place that may use the Joplin plugin API (`api`).
- `src/editor/` is the CodeMirror content script, bundled for the editor webview.
- `src/viewer/` is the markdown-it content script and its plain-script asset, bundled for the note viewer.
- `src/dialog/` is the resize dialog's webview script and stylesheet.
- `src/shared/` holds runtime-neutral code (types, logger, cross-runtime contracts, pure helpers) bundled into more than one of the above.

`eslint.config.mjs` enforces this with `@typescript-eslint/no-restricted-imports`: a runtime folder cannot import values from another runtime folder, and only `src/host/` may import values from `api` or `api/types`. Type-only imports may cross boundaries since they are erased at build time. Code needed by two runtimes belongs in `src/shared/`.

The built output mirrors these folders, so registration paths such as `./editor/cursorContentScript.js`, `./viewer/viewerContentScript.js`, and `./dialog/resizeDialog.js` must match `plugin.config.json`.

## Main Pieces

### Plugin Shell

- `src/index.ts` boots the plugin, registers settings, commands, menus, toolbar integration, and the CodeMirror content script.
- `src/host/settings.ts` defines plugin settings and exposes cached configuration.
- The `showFormattingToolbarIcon` setting defaults to `true` and is checked in `src/index.ts` only at startup before registering the Markdown formatting toolbar button. Changing it requires restarting Joplin.
- `src/host/menus.ts` wires the command surface into Joplin menus, toolbar, and context menu behavior (editor and markdown viewer).
- `src/host/quickResizeOptions.ts` parses and normalizes the configurable quick resize slot setting, then converts slots into resize requests.

### Detection and Editor Operations

- `src/editor/cursorContentScript.ts` runs inside the CodeMirror editor context.
- It is the source of truth for cursor-based image detection, editor text replacement, dimension lookup in editor context, and editor-origin context menu checks.
- Detection is syntax-tree based, not regex-first. It recognizes Markdown image nodes plus HTML `img` tags, including nested HTML blocks.
- `src/shared/editorCommands.ts` is the shared contract between the host and the content script: the content script ID, every editor command name, and the replace-range argument shape. It has no runtime dependencies, so host modules never import from the content script itself.
- `src/editor/imageSyntaxParser.ts` owns the lightweight regex extraction that pulls source, alt text, and title from syntax-tree-validated image nodes.
- Leading indentation on an image line can be treated as part of the activation area, while replacement still targets only the image syntax itself.
- `src/host/editorBridge.ts` is the thin plugin-side wrapper around these content script commands. Every `editor.execCommand` call the host makes goes through it, including text replacement and editor-context dimension measurement.
- `src/viewer/viewerContentScript.ts` is a markdown-it content script for the markdown viewer; see Viewer Context Menu below.
- The detection and document-mutation logic lives in `src/editor/editorImageQueries.ts`, separate from the Joplin/CodeMirror wiring: `findImagesOnLine`, `findImageForViewerTarget`, `getImageAtCursor`, `isCursorInImageActivationRange`, `posToOffset`, and `resolveReplaceChange` take an `EditorState` or `Text` instead of an `EditorView`. Only the command handlers registered by `cursorContentScript.ts` need the view (for `dispatch` and DOM events). Tests build a real `EditorState` with `@codemirror/lang-markdown` and drive these directly.

### Resize Pipeline

- `src/host/originalImageDimensions.ts` resolves dimensions using layered strategies so the plugin works across desktop, Android, and the web app. It owns fallback-dimension policy for both resource and external images; an invalid resource ID is still rejected outright, while a non-http(s) external source (relative path, `data:` URI) falls back to default dimensions so the resize dialog still opens. On desktop and the web app, resource bytes from the Data API are normalized into a `Uint8Array`, wrapped in a `Blob`, and measured through a temporary object URL without base64 conversion. Native mobile cannot transport the resource endpoint's Buffer through the plugin API, so it relies on editor-context measurement instead. External images are loaded without a referrer and without requiring CORS, since only their intrinsic dimensions are read.
- `src/host/resizeDialogHost.ts` builds and runs the resize dialog through an injected Joplin API boundary. It lazily creates one dialog handle and reuses it for every later invocation. The handle is never re-created: Joplin derives it from the dialog id and throws "View already added" when that id is registered twice, so a failed setup retries only the configuration steps (fit-to-content, scripts, buttons) against the handle that already exists. Overlapping opens are ignored, because Joplin resolves the *pending* first `open()` with null and hands the dialog to the later caller, which would silently cancel the invocation the user is looking at.
- `src/dialog/resizeDialog.ts` initializes each freshly rendered dialog root once, tracked by a `data-initialized` marker on the root. Joplin unmounts a dialog's webview when it closes and remounts it on the next open, and it applies the new HTML before loading the scripts, so the script runs once per open against markup that is already in place. Both apps also inject the script after the document is parsed, so no observer, `DOMContentLoaded` listener, or other re-entry mechanism is needed; the marker only keeps the exported function idempotent for callers that invoke it directly. If Joplin ever kept a dialog webview mounted across opens, this would need revisiting, because `setHtml` replaces the content element's markup without re-running the scripts.
- `src/shared/dialogFieldState.ts` is the single source of the dialog's control rules (which inputs are enabled or dimmed for a syntax and resize mode, and the fallback from percentage to absolute when original dimensions are unknown). The host uses it to render the initial markup so the dialog opens in the right state before its script runs, and the webview script applies the same function on every syntax or mode change. It is pure and browser-safe because both sides bundle it.
- `src/host/imageSyntaxBuilder.ts` converts dialog choices into final Markdown or HTML output. It is pure: callers pass the HTML syntax style setting in rather than the builder reading the settings cache.
- Quick resize commands use five stable command slots with default values `100%, 75%, 50%, 33%, 25%`.

The dialog script focuses the Alt text input after initializing the form on each open. Joplin focuses the dialog iframe for keyboard shortcuts; the plugin selects the initial input explicitly.

### Shared Utilities

- `src/shared/imageDimensionUtils.ts` contains shared DOM image measurement and dimension-validation logic plus the image load timeouts, kept runtime dependency-free so both execution contexts can import them.
- `src/host/resourceUtils.ts` handles resource-specific helpers.
- `src/shared/stringUtils.ts` handles HTML entity decoding and output escaping.
- `src/host/toastUtils.ts` centralizes toast messaging.
- `src/shared/logger.ts` and `src/shared/types.ts` provide logging and core types.

## Detection Model

The architecture separates image detection from image extraction:

- Detection uses CodeMirror's syntax tree so the plugin can reason about real Markdown and HTML structure instead of raw text alone.
- Extraction uses focused regex patterns only after a syntax node has already been identified as an image.

That split keeps detection reliable while keeping the extraction code small and easy to maintain.

## Viewer Context Menu

Right-clicking a resource image in the desktop markdown viewer offers the same resize items as the editor. Opening the menu checks the matching image without changing the editor cursor. Choosing a resize item passes its viewer target as a command argument; the command then selects the image in the mounted CodeMirror editor and runs the existing cursor-based resize flow.

- `viewerContentScript.ts` runs only when Joplin renders with `mapsToLine` (the note viewer). It stamps each rendered image with the source line range of the block it came from (markdown-it's token map; table cells use their row) and its index among the images in that range. Markdown images carry the position in `token.meta` and get the attributes in a wrapped `image` render rule, because Joplin rebuilds resource images from scratch; HTML `<img>` tags get the attributes written into the token content. An instance marker keeps repeated installation from adding the core rule or render wrapper twice.
- `viewerContextMenu.js` is a plain-script viewer asset. On every viewer right-click it posts the clicked image's `ViewerImageTarget` (line range, index, `data-resource-id`), or `null`, with the click time to the plugin. The asset is `// @ts-check`ed and casts `window` and Joplin's injected `webviewApi` locally via JSDoc to types exported from `viewerContextMenuTypes.d.ts`. That module declares no globals, so plugin-side and dialog code cannot reference `webviewApi` without a type error. `viewerMessages.ts` reuses its `ViewerContextMenuMessage` type for the message it receives.
- `src/host/viewerMessages.ts` receives those messages and registers the viewer content script. For a context menu that did not originate in the editor, the filter takes a recent click message from at or before that menu request's start (waiting briefly if Joplin's menu request arrived first) and runs a read-only editor match command. A timed-out or editor-origin menu discards its click time, so a delayed message cannot target a later menu. A newer click remains available to its own menu when an older request is still waiting. Items are added only when the editor confirms the viewer image still matches the note source. The resize command revalidates and selects the image when chosen.
- `findImageForViewerTarget` in `editorImageQueries.ts` ensures the syntax tree is parsed through the target's line range, then counts images starting in that range with the same rules as the markdown-it side and checks the resource ID matches. It fails safe when parsing times out or the viewer render is out of date.
- `src/shared/viewerImageTarget.ts` holds the shared contract (content script ID, attribute names, target validation). The viewer asset repeats the ID and attribute names because it cannot import modules; `tests/viewerContextMenuAsset.test.ts` runs the actual asset against renderer output and checks its message ID and target, so drift fails the test suite.
- External images are not supported: Joplin's viewer only opens a context menu for images with a `data-resource-id`.

## Platform Strategy

The same high-level flow is used on desktop, Android, and the web app, but dimension lookup adapts to platform capabilities:

- Prefer editor-context access when available.
- On desktop and the web app, fall back to Blob object URL loading when resource bytes are available, always revoking the temporary URL after measurement.
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
- Inside the content script, parsing and range resolution are view-independent functions in their own module; the view is only touched at the command boundary. That keeps the code that mutates a user's note unit-testable.
- Syntax generation is separate from detection.
- Platform-specific dimension lookup is isolated behind a single `getOriginalImageDimensions` entry point.

The result is a small pipeline: detect, measure, prompt, build, replace.
