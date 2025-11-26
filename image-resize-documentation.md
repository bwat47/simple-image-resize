# simple-image-resize - Architecture (Concise)

Goal: Markdown + HTML image syntax conversion and lossless image resizing in Joplin with direct, in-editor replacement of the image embed.

## Flow Overview

1. **Detect image:** Content script uses CodeMirror syntax tree to find image at cursor position; validates as Markdown, simple HTML, or nested HTML; extracts details via regex; returns complete context + replace range in single call.
2. **Determine dimensions:** Use platform-appropriate strategies (content script for Android/Desktop, base64 for Web app) with fallback to defaults. Apply timeouts.
3. **Show dialog:** Inline JS-powered modal (compiled from `dialog/resizeDialog.ts`) toggles syntax/mode availability; syntax defaults to HTML while resize mode respects settings. User chooses target syntax + resize mode + values + alt/title.
4. **Build & replace:** Generate new syntax with proper escaping (HTML entities for attributes, quote-only for Markdown titles); replace at detected range via content script; toast on success.

## Platform Support

The plugin supports Desktop, Android, and Web app through platform-specific strategies:

| Platform | Cursor Detection | Text Replacement | Dimension Fetching                |
| -------- | ---------------- | ---------------- | --------------------------------- |
| Desktop  | Content script   | Content script   | Content script or Base64          |
| Android  | Content script   | Content script   | Content script (via resourcePath) |
| Web App  | Content script   | Content script   | Base64 conversion                 |

**Dimension fetching strategy order:**

1. Content script with `joplin.data.resourcePath()` - works on Android + Desktop
2. Base64 conversion via `joplin.data.get(['resources', id, 'file'])` - works on Web app + Desktop
3. Default dimensions (400x300) - fallback when all strategies fail

## Core Modules (src/)

- `index.ts` - Plugin bootstrap: orchestrates initialization by calling `registerSettings()`, `registerCommands()`, `registerMenus()`, `registerToolbarButton()`, and `registerContextMenu()`. Registers the CodeMirror content script.
- `settings.ts` - Settings registration for default resize mode and context menu behavior; exports setting key constants for type-safe access.
- `commands.ts` - Command registration for all resize operations (resizeImage dialog + quick resize commands: 100%, 75%, 50%, 25%) and copy image to clipboard; includes shared helpers for image detection, dimension fetching, and editor replacement.
- `menus.ts` - Menu registration: creates Tools submenu with keyboard shortcuts (CmdOrCtrl+Shift+R/1/2/3/4), toolbar button for mobile access, and dynamic context menu based on cursor position and settings.
- `dialogHandler.ts` - Modal dialog HTML generation and script/CSS loading; collects result; controls state defaults via `getInitialDialogState` helper.
- `dialogLock.ts` - Lightweight lock guard so the resize dialog can only open once at a time, avoiding overlapping modal instances.
- `dialog/resizeDialog.css` - Dialog stylesheet with theme-aware styling using Joplin CSS variables; includes custom radio buttons, utility classes.
- `dialog/resizeDialog.ts` - TypeScript source for browser-side controller (compiled to `.js` during build); syncs syntax + resize radios, disables fields, aspect ratio preservation.
- `contentScripts/cursorContentScript.ts` - CodeMirror 6 content script running in editor context. Uses syntax tree for reliable image detection (Markdown, simple HTML, nested HTML). Registers commands: `GET_IMAGE_AT_CURSOR_COMMAND` (syntax tree-based detection + extraction), `REPLACE_RANGE_COMMAND` (text replacement), `GET_IMAGE_DIMENSIONS_COMMAND` (dimension measurement using shared utility). The editor context has file access on mobile platforms. Imports shared regex patterns and utilities for extraction after syntax tree validation.
- `cursorDetection.ts` - Thin wrapper around content script's `GET_IMAGE_AT_CURSOR_COMMAND`; returns image context + editor range. Single content script call provides complete detection results.
- `imageSizeCalculator.ts` - Multi-strategy dimension fetching: content script (Android/Desktop) → base64 (Web/Desktop) → defaults. Uses shared dimension measurement utility for base64 and external images.
- `imageSyntaxBuilder.ts` - Generates Markdown/HTML output; preserves/escapes alt and optional title; applies width attribute for HTML with optional height attribute based on settings (preserves aspect ratio).
- `utils/stringUtils.ts` - Decode HTML entities on input; escape for HTML attributes and Markdown title. `escapeMarkdownTitle()` only escapes quotes (not HTML entities or backslashes) because regex extracts raw text and Markdown doesn't interpret HTML entities.
- `utils/resourceUtils.ts` - Resource ID validation and base64 conversion for web app compatibility.
- `utils/imageDimensionUtils.ts` - Shared image dimension measurement utility. Provides `measureImageDimensions()` for loading images via DOM Image with configurable timeout and privacy settings. Used by both main plugin context and content script context to eliminate code duplication.
- `utils/clipboardUtils.ts` - Clipboard operations for copying images. Handles both Joplin resources and external URLs with AbortController-based timeout for network requests. Includes canvas-based conversion for WebP/AVIF formats with CORS error handling.
- `utils/toastUtils.ts` - Toast notification wrapper with setting-controlled display; respects `showToastMessages` setting.
- `logger.ts` - Centralized logging utility. Provides debug(), info(), warn(), and error() methods with configurable log levels (DEBUG, INFO, WARN, ERROR, NONE). Log level can be adjusted at runtime via browser console using `console.simpleImageResize.setLogLevel(level)` and `console.simpleImageResize.getLogLevel()`. Defaults to WARN level.
- `constants.ts` - Simplified regex patterns for extraction (used with syntax tree detection), timeout constants, and default fallback dimensions.
- `types.ts` - Strong types for contexts, options, dialog result, dimensions.
- `tests/test-utils/imageExtraction.ts` - Test utility for validating extraction regex patterns without CodeMirror mocking. Tests same patterns used by content script.

## Detection & Extraction Architecture

**Detection:** Uses CodeMirror's syntax tree (`@codemirror/language`) for reliable, context-aware detection.

**Node types detected:**
- `Image` - Markdown images: `![alt](url)`
- `HTMLTag` - Simple HTML in Markdown: `<img src="...">`
- `HTMLBlock` - Nested HTML in Markdown: `<div><img src="..."></div>`

**Benefits:**
- No false positives (won't match images in code blocks or inline code)
- Accurate cursor position detection using node boundaries
- Single content script call returns complete results

**Extraction:** After syntax tree validates an image node, simplified regex patterns extract details:

```ts
// Extract parts from validated Markdown image: ![alt](src "title")
MARKDOWN_EXTRACT: /!\[(?<altText>[^\]]*)\]\(\s*(?<src>[^)\s]+)(?:\s+["'](?<title>[^"']+)["'])?\s*\)/

// Extract resource ID or external URL from source
RESOURCE_ID: /:\/([a-f0-9]{32})/
EXTERNAL_URL: /(https?:\/\/[^\s"']+)/

// Extract HTML img attributes (using backreferences for quote matching)
HTML_SRC: /src=(["'])([^"']+)\1/i
HTML_ALT: /alt=(["'])(.*?)\1/i
HTML_TITLE: /title=(["'])(.*?)\1/i
```

**Notes:**
- Extraction patterns are simpler (~40% less complex) because detection is handled by syntax tree
- Patterns only extract from validated image nodes, not detect images
- Markdown title regex captures raw text without interpreting escape sequences
- HTML extraction decodes entities (`&quot;` → `"`, `&amp;` → `&`, etc.)
- Titles are optional; preserved across conversions

## Cursor Detection Logic

**Content Script Architecture:**
- `cursorContentScript.ts` uses CodeMirror's syntax tree API (`syntaxTree()`) for detection
- `GET_IMAGE_AT_CURSOR_COMMAND` performs syntax tree traversal of current line
- `findImagesOnLine()` searches for `Image`, `HTMLTag`, and `HTMLBlock` nodes
- Returns complete image context + `{ from, to }` range in single call

**Plugin Integration:**
- `detectImageAtCursor()` thin wrapper around content script command
- `isOnImageInMarkdownEditor()` gates context menu by checking cursor position
- User places cursor anywhere within image syntax and invokes command
- Works on Desktop, Android, and Web app through content script

**Benefits:**
- No regex matching in main plugin code
- Reliable detection using CodeMirror's parser (no false positives)
- Single content script call provides all details (was 2 calls + regex matching)
- `DialogLock` ensures only one resize dialog instance per editor session

## Resizing & Emission

- Resize modes:
    - Percentage: preserve aspect ratio; compute width/height from original.
    - Absolute: width/height; auto-calc the missing dimension and keep both fields synced to preserve aspect ratio.
    - When targeting HTML with percentage mode, the dialog previews the computed width/height so users can see resulting dimensions while the absolute inputs remain disabled.
- Markdown output: original size only (resize controls disabled when targeting Markdown).
- HTML output: always includes `width` attribute; `height` attribute is conditionally included based on the `htmlSyntaxStyle` setting (both attributes preserve aspect ratio; width-only provides cleaner syntax for Joplin which auto-calculates height, while width-and-height improves compatibility when pasting to external sources).
- Quick resize commands (100%, 75%, 50%, 25%):
    - 100%: Converts image to Markdown syntax (removes custom sizing).
    - 75%/50%/25%: Converts to HTML with specified percentage of original dimensions.
    - Available via Tools menu with default keyboard shortcuts or optionally in context menu.

## Alt/Title Handling (Round-trip)

**Input (HTML → Dialog):**
- Decode HTML entities: `&quot;` → `"`, `&apos;` → `'`, `&amp;` → `&`, `&lt;` → `<`, `&gt;` → `>`
- Dialog shows plain text for user editing

**Output Escaping:**

*HTML attributes* (`escapeHtmlAttribute`):
- Escape: `&` → `&amp;`, `"` → `&quot;`, `'` → `&#39;`, `<` → `&lt;`, `>` → `&gt;`
- Standard HTML entity encoding

*Markdown title* (`escapeMarkdownTitle`):
- Only escape: `"` → `\"`
- **Do NOT escape:** `&`, `\`, `<`, `>` (Markdown doesn't interpret HTML entities)
- Regex captures raw text without escape sequences, so output raw text

**Round-trip Stability:**
- Markdown `"test & <ok>\ABC"` → HTML `title="test &amp; &lt;ok&gt;\ABC"` → Markdown `"test & <ok>\ABC"` ✓
- No accumulation of escaped characters on repeated conversions
- Fixed double-escaping issues with ampersands and backslashes

## Settings

- `imageResize.defaultResizeMode`: `'percentage' | 'absolute'` - used to preselect dialog mode.
- `imageResize.showQuickResizeInContextMenu`: `boolean` - when enabled, shows quick resize options (100%, 75%, 50%, 25%) in the right-click context menu alongside the main "Resize Image" option.
- `imageResize.showCopyImageInContextMenu`: `boolean` - when enabled, shows "Copy Image" option in the right-click context menu to copy images to clipboard.
- `imageResize.htmlSyntaxStyle`: `'widthAndHeight' | 'widthOnly'` - controls whether HTML image tags include both width and height attributes (default; better compatibility for pasting outside Joplin) or just width (cleaner; Joplin auto-calculates height).
- `imageResize.showToastMessages`: `boolean` - when enabled (default), displays brief toast notifications for plugin actions (success, errors, info). Disable to suppress all toast messages.
- **Note**: Syntax always defaults to HTML in the dialog (not user-configurable).

## Editor Integration

- Tools menu submenu "Simple Image Resize" contains all resize commands with keyboard shortcuts:
    - Resize Image (CmdOrCtrl+Shift+R) - opens dialog
    - Resize 100% (CmdOrCtrl+Shift+1) - convert to Markdown
    - Resize 75% (CmdOrCtrl+Shift+2)
    - Resize 50% (CmdOrCtrl+Shift+3)
    - Resize 25% (CmdOrCtrl+Shift+4)
- Toolbar button in editor toolbar for mobile access (no keyboard shortcuts on mobile).
- Context menu limited to Markdown editor via `workspace.filterEditorContextMenu`; avoids showing in rich text editor.
- Context menu shows "Resize Image" always when cursor is on an image; quick resize options appear when `showQuickResizeInContextMenu` setting is enabled; "Copy Image" option appears when `showCopyImageInContextMenu` setting is enabled.
- Replacement uses content script command with the range detected by cursor detection.

## Errors & UX

- Error message when cursor is not on an image: "No valid image found. Place cursor inside an image embed."
- Try/catch around command execution with error logs and user toasts (success/error).
- When dimension fetching fails on all strategies, default dimensions (400x300) are used silently to keep UX responsive.

## Performance & Privacy

- Timeouts for image probes (5s for resources, 10s for external); defaults applied on failure to keep UX responsive.
- External images: DOM Image with `crossOrigin='anonymous'` and `referrerPolicy='no-referrer'` to minimize tracking.
- Resource dimension fetching tries fastest method first (content script), falls back to base64 conversion.

## Testing Focus (Jest)

All 38 tests passing:

- `imageDetection` (10 tests) - Validates extraction regex patterns: Markdown/HTML extraction, resource vs external, titles, HTML entity decoding, escaped `)` in URLs. Test utility (`tests/test-utils/imageExtraction.ts`) mirrors content script extraction logic.
- `imageSyntaxBuilder` (14 tests) - Markdown/HTML conversion, alt/title escaping/decoding, width/height emission (both widthAndHeight and widthOnly modes), round-trip stability (no accumulation of escaped characters).
- `dialogHandler` (13 tests) - Initial state calculation for dialog based on syntax and resize mode, field enabling/disabling logic.
- `dialogLock` (4 tests) - Lock acquisition and release behavior, prevents overlapping dialog instances.

**Note:** Content script itself is not unit tested (would require complex CodeMirror mocks). Instead, extraction patterns are validated through test utility that uses same regex patterns as production code.

## Non-Goals / Exclusions

- No batch processing (single image per operation).
- No inline preview in dialog.
- Markdown syntax does not support explicit width/height (by design of this plugin).

## Future Ideas

- Batch processing across a selection.
- Inline thumbnail preview.
- Additional quick resize presets (e.g., 10%, 33%, 150%, 200%).
- Additional output formats (e.g., Pandoc-style Markdown width hints).

## Summary

A focused command + dialog plugin: detect a single image at cursor position (Markdown or HTML, resource or external), gather dimensions with reliable cross-platform fallbacks, offer simple resize choices, and emit clean, escaped syntax with direct in-editor replacement and clear user feedback. Works on Desktop, Android, and Web app.

## Architecture Evolution

**Syntax Tree Refactoring (current):**
- Detection: CodeMirror syntax tree API (`@codemirror/language`)
- Extraction: Simplified regex patterns (~40% less complex)
- Benefits: No false positives, reliable cursor detection, single content script call, supports nested HTML

**Previous Architecture:**
- Detection + Extraction: Complex regex patterns handled both
- Multiple content script calls required
- Potential for false positives in code blocks

The refactoring separated concerns (syntax tree for detection, regex for extraction), simplified code, and improved reliability while maintaining all existing functionality.
