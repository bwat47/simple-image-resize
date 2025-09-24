# simple-image-resize – Architecture (Concise)

Goal: Markdown ↔ HTML image syntax conversion and lossless image resizing in Joplin with direct, in-editor replacement of the image embed.

## Flow Overview

1. Acquire input: prefer validated selection; else detect image at cursor (same line scan) and compute replace range.
2. Detect syntax: parse Markdown or HTML image (resource or external); extract alt/title; build `ImageContext`.
3. Determine dimensions: query Joplin Imaging API; fall back to DOM `Image` probes when needed (resource base64 / external with CORS safeguards). Apply timeouts and defaults.
4. Show dialog: CSS-driven UI with minimal JS sync; default resize mode from settings. User chooses target syntax + resize mode + values + alt/title.
5. Emit + replace: build new syntax (escape/encode consistently) and replace selection or range; toast on success.

## Core Modules (src/)

- `index.ts` — Plugin bootstrap: settings, command registration, context menu filter, command execution and replacement.
- `dialogHandler.ts` — Modal dialog HTML/CSS/JS; radio-based CSS state control; collects result.
- `imageDetection.ts` — Detects Markdown/HTML image, extracts alt/title, resourceId/url, computes editor range; cursor-based detection.
- `imageSizeCalculator.ts` — Dimensions via Imaging API; fallbacks (base64 DOM Image for resources; external Image with `crossOrigin='anonymous'` + `referrerPolicy='no-referrer'`); timeouts; aspect ratio math.
- `imageSyntaxBuilder.ts` — Generates Markdown/HTML output; preserves/escapes alt and optional title; applies width/height for HTML.
- `selectionValidation.ts` — Ensures exactly one image; friendly messages for empty/multiple/invalid selections.
- `stringUtils.ts` — Decode HTML entities on input; escape for HTML attributes and Markdown title.
- `utils.ts` — Joplin helpers (resource base64, command wrappers, toasts).
- `constants.ts` — Regex patterns, timeouts, setting keys, small helpers.
- `types.ts` — Strong types for contexts, options, dialog result, dimensions.

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

## Cursor/Selection Logic

- `detectImageAtCursor` scans the current line; if cursor lies within a detected embed, returns partial context + `{ from, to }` range.
- `isOnImageInMarkdownEditor` gates the context menu: a safe `editor.execCommand` probe (e.g., `getCursor`) determines Markdown editor scope.
- Command prefers validated selection; otherwise uses cursor detection to avoid requiring preselection.

## Resizing & Emission

- Resize modes:
    - Percentage: preserve aspect ratio; compute width/height from original.
    - Absolute: width/height; auto-calc the missing dimension.
- Markdown output: original size only (resize controls disabled when targeting Markdown).
- HTML output: include `width` and `height` attributes when resizing.

## Alt/Title Handling (Round-trip)

- Input: decode entities from HTML (`&quot;`, `&apos;`, `&amp;`, etc.) so dialog shows plain text.
- Output escaping:
    - HTML attributes: escape `&`, `"`, `'` (as `&#39;`), `<`, `>`.
    - Markdown title (within quotes): escape `&`, `"`, `<`, `>`.

## Settings

- `imageResize.defaultResizeMode`: `'percentage' | 'absolute'` — used to preselect dialog mode.

## Editor Integration

- Context menu limited to Markdown editor via `workspace.filterEditorContextMenu` + safe probe; avoids showing in rich text editor.
- Replacement uses `editor.execCommand`:
    - `replaceSelection(newSyntax)` when selection is valid.
    - `replaceRange(newSyntax, from, to)` when using cursor-based detection.

## Errors & UX

- Validation messages:
    - Empty selection: “Please select an image syntax to resize.”
    - Multiple images: “Multiple images found. Please select a single image syntax.”
    - Invalid syntax: “No valid image syntax found. Please select ![...](:/...) or <img src=":/..." ...>”.
- Try/catch around command execution with `[Image Resize]` error logs and user toasts (success/error).

## Performance & Privacy

- Timeouts for image probes; external probe defaults applied on failure (e.g., 400×300) to keep UX responsive.
- Resource fallback: base64 + DOM Image when Imaging API reports 0×0 (e.g., WEBP).
- External fallback: DOM Image with `crossOrigin='anonymous'` and `referrerPolicy='no-referrer'` to minimize leakage.
- Lightweight dialog (CSS transitions; minimal JS), avoids heavy editor integrations.

## Testing Focus (Jest)

- `imageDetection` — Markdown/HTML detection, resource vs external, titles, escaped `)`.
- `imageSyntaxBuilder` — Markdown↔HTML conversion, alt/title escaping/decoding, width/height emission.
- `selectionValidation` — single-image enforcement and messages.

## Non-Goals / Exclusions

- No batch processing (single image per operation).
- No inline preview in dialog.
- Markdown syntax does not support explicit width/height (by design of this plugin).
- Mobile not tested.

## Future Ideas

- Batch processing across a selection.
- Inline thumbnail preview.
- Presets (e.g., 25/50/75/100%).
- Keyboard shortcuts for quick resize.
- Additional output formats (e.g., Pandoc-style Markdown width hints).

## Summary

A focused command + dialog plugin: detect a single image (Markdown or HTML, resource or external), gather dimensions with reliable fallbacks, offer simple resize choices, and emit clean, escaped syntax with direct in-editor replacement and clear user feedback.
