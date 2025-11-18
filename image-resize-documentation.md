# simple-image-resize - Architecture (Concise)

Goal: Markdown + HTML image syntax conversion and lossless image resizing in Joplin with direct, in-editor replacement of the image embed.

## Flow Overview

1. Acquire input: detect image at cursor (same line scan) and compute replace range.
2. Detect syntax: parse Markdown or HTML image (resource or external); extract alt/title; build `ImageContext`.
3. Determine dimensions: query Joplin Imaging API; fall back to DOM `Image` probes when needed (resource base64 / external with CORS safeguards). Apply timeouts and defaults.
4. Show dialog: Inline JS-powered modal (compiled from `dialog/resizeDialog.ts`) toggles syntax/mode availability; syntax defaults to HTML while resize mode respects settings. User chooses target syntax + resize mode + values + alt/title.
5. Emit + replace: build new syntax (escape/encode consistently) and replace at detected range; toast on success.

## Core Modules (src/)

- `index.ts` - Plugin bootstrap: orchestrates initialization by calling `registerSettings()`, `registerCommands()`, `registerMenus()`, and `registerContextMenu()`.
- `settings.ts` - Settings registration for default resize mode and context menu behavior; exports setting key constants for type-safe access.
- `commands.ts` - Command registration for all resize operations (resizeImage dialog + quick resize commands: 100%, 75%, 50%, 25%); includes shared helpers for image detection, dimension fetching, and editor replacement.
- `menus.ts` - Menu registration: creates Tools submenu with keyboard shortcuts (CmdOrCtrl+Shift+R/1/2/3/4) and dynamic context menu based on cursor position and settings.
- `dialogHandler.ts` - Modal dialog HTML generation and script/CSS loading; collects result; controls state defaults via `getInitialDialogState` helper.
- `dialogLock.ts` - Lightweight lock guard so the resize dialog can only open once at a time, avoiding overlapping modal instances.
- `dialog/resizeDialog.css` - Dialog stylesheet with theme-aware styling using Joplin CSS variables; includes custom radio buttons, utility classes, and responsive breakpoints.
- `dialog/resizeDialog.ts` - TypeScript source for browser-side controller (compiled to `.js` during build); syncs syntax + resize radios, disables fields, aspect ratio preservation.
- `imageDetection.ts` - Detects Markdown/HTML image, extracts alt/title, resourceId/url.
- `cursorDetection.ts` - Scans current line for image syntax at cursor position; returns partial context + editor range.
- `imageSizeCalculator.ts` - Dimensions via Imaging API; fallbacks (base64 DOM Image for resources; external Image with `crossOrigin='anonymous'` + `referrerPolicy='no-referrer'`); timeouts; aspect ratio math.
- `imageSyntaxBuilder.ts` - Generates Markdown/HTML output; preserves/escapes alt and optional title; applies width attribute for HTML (height auto-calculated by Joplin).
- `stringUtils.ts` - Decode HTML entities on input; escape for HTML attributes and Markdown title.
- `utils.ts` - Joplin helpers (resource base64, command wrappers, toasts).
- `logger.ts` - Centralized logging utility. Provides debug(), info(), warn(), and error() methods with configurable log levels (DEBUG, INFO, WARN, ERROR, NONE). Log level can be adjusted at runtime via browser console using joplinLogger.setLevel(level) and joplinLogger.getLevel(). Defaults to WARN level.
- `constants.ts` - Regex patterns, timeout constants, and default fallback dimensions.
- `types.ts` - Strong types for contexts, options, dialog result, dimensions.

## Detection Rules (essentials)

```ts
// Markdown (single; resource or external; optional title)
const MARKDOWN_IMAGE_FULL =
    /!\[(?<altText>[^\]]*)\]\(\s*(?::\/(?<resourceId>[a-f0-9]{32})|(?<url>https?:\/\/(?:\\\)|[^)\s])+))\s*(?:"(?<titleDouble>[^"]*)"|'(?<titleSingle>[^']*)')?\s*\)/i;

// HTML <img> (single; resource or external)
const HTML_IMAGE_FULL = /<img\s+[^>]*src=["'](?::\/(?<resourceId>[a-f0-9]{32})|(?<url>https?:\/\/[^"']+))["'][^>]*>/i;

// Attribute extraction
const IMG_ALT = /\balt\s*=\s*(["'])(.*?)\1/i;
const IMG_TITLE = /\btitle\s*=\s*(["'])(.*?)\1/i;

// Multi-image/global count
const ANY_IMAGE_GLOBAL = /(?:!\[[^\]]*\]\([^)]*\))|(?:<img\s+[^>]*>)/gi;
```

Notes:

- Markdown URL supports escaped `)` via `%29` or backslash.
- Titles are optional; preserved across conversions.

## Cursor Detection Logic

- `detectImageAtCursor` scans the current line; if cursor lies within a detected embed, returns partial context + `{ from, to }` range.
- `isOnImageInMarkdownEditor` gates the context menu: a safe `editor.execCommand` probe (e.g., `getCursor`) determines Markdown editor scope.
- Command uses cursor detection exclusively - user simply places cursor anywhere within the image line and invokes the command.
- `DialogLock` ensures only one resize dialog instance can be opened per editor session; additional invocations are ignored until the active dialog resolves or is cancelled.

## Resizing & Emission

- Resize modes:
    - Percentage: preserve aspect ratio; compute width/height from original.
    - Absolute: width/height; auto-calc the missing dimension and keep both fields synced to preserve aspect ratio.
    - When targeting HTML with percentage mode, the dialog previews the computed width/height so users can see resulting dimensions while the absolute inputs remain disabled.
- Markdown output: original size only (resize controls disabled when targeting Markdown).
- HTML output: include `width` attribute only (Joplin auto-calculates height based on aspect ratio).
- Quick resize commands (100%, 75%, 50%, 25%):
    - 100%: Converts image to Markdown syntax (removes custom sizing).
    - 75%/50%/25%: Converts to HTML with specified percentage of original dimensions.
    - Available via Tools menu with default keyboard shortcuts or optionally in context menu.

## Alt/Title Handling (Round-trip)

- Input: decode entities from HTML (`&quot;`, `&apos;`, `&amp;`, etc.) so dialog shows plain text.
- Output escaping:
    - HTML attributes: escape `&`, `"`, `'` (as `&#39;`), `<`, `>`.
    - Markdown title (within quotes): escape `&`, `"`, `<`, `>`.

## Settings

- `imageResize.defaultResizeMode`: `'percentage' | 'absolute'` - used to preselect dialog mode.
- `imageResize.showQuickResizeInContextMenu`: `boolean` - when enabled, shows quick resize options (100%, 75%, 50%, 25%) in the right-click context menu alongside the main "Resize Image" option.
- **Note**: Syntax always defaults to HTML in the dialog (not user-configurable).

## Editor Integration

- Tools menu submenu "Simple Image Resize" contains all resize commands with keyboard shortcuts:
    - Resize Image (CmdOrCtrl+Shift+R) - opens dialog
    - Resize 100% (CmdOrCtrl+Shift+1) - convert to Markdown
    - Resize 75% (CmdOrCtrl+Shift+2)
    - Resize 50% (CmdOrCtrl+Shift+3)
    - Resize 25% (CmdOrCtrl+Shift+4)
- Context menu limited to Markdown editor via `workspace.filterEditorContextMenu` + safe probe; avoids showing in rich text editor.
- Context menu shows "Resize Image" always when cursor is on an image; quick resize options appear when `showQuickResizeInContextMenu` setting is enabled.
- Replacement uses `editor.execCommand('replaceRange', [newSyntax, from, to])` with the range detected by cursor detection.

## Errors & UX

- Error message when cursor is not on an image: "No valid image found. Place cursor inside an image embed."
- Try/catch around command execution with error logs and user toasts (success/error).

## Performance & Privacy

- Timeouts for image probes; external probe defaults applied on failure (e.g., 400x300) to keep UX responsive.
- Resource fallback: base64 + DOM Image when Imaging API reports 0x0 (e.g., WEBP).
- External fallback: DOM Image with `crossOrigin='anonymous'` and `referrerPolicy='no-referrer'` to minimize leakage.

## Testing Focus (Jest)

- `imageDetection` - Markdown/HTML detection, resource vs external, titles, escaped `)`.
- `imageSyntaxBuilder` - Markdown/HTML conversion, alt/title escaping/decoding, width/height emission.
- `dialogHandler` - Initial state calculation for dialog based on syntax and resize mode.

## Non-Goals / Exclusions

- No batch processing (single image per operation).
- No inline preview in dialog.
- Markdown syntax does not support explicit width/height (by design of this plugin).
- Mobile not tested.

## Future Ideas

- Batch processing across a selection.
- Inline thumbnail preview.
- Additional quick resize presets (e.g., 10%, 33%, 150%, 200%).
- Additional output formats (e.g., Pandoc-style Markdown width hints).

## Summary

A focused command + dialog plugin: detect a single image at cursor position (Markdown or HTML, resource or external), gather dimensions with reliable fallbacks, offer simple resize choices, and emit clean, escaped syntax with direct in-editor replacement and clear user feedback.
