# simple-image-resize - Architecture (Concise)

Goal: Markdown + HTML image syntax conversion and lossless image resizing in Joplin with direct, in-editor replacement of the image embed.

## Flow Overview

1. Acquire input: detect image at cursor (same line scan) and compute replace range.
2. Detect syntax: parse Markdown or HTML image (resource or external); extract alt/title; build `ImageContext`.
3. Determine dimensions: use platform-appropriate strategies (content script for Android/Desktop, base64 for Web app) with fallback to defaults. Apply timeouts.
4. Show dialog: Inline JS-powered modal (compiled from `dialog/resizeDialog.ts`) toggles syntax/mode availability; syntax defaults to HTML while resize mode respects settings. User chooses target syntax + resize mode + values + alt/title.
5. Emit + replace: build new syntax (escape/encode consistently) and replace at detected range; toast on success.

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
- `contentScripts/cursorContentScript.ts` - CodeMirror 6 content script running in editor context. Registers commands for cursor info retrieval, text replacement, and image dimension measurement. The editor context has file access on mobile platforms.
- `imageDetection.ts` - Detects Markdown/HTML image, extracts alt/title, resourceId/url.
- `cursorDetection.ts` - Uses content script to get cursor position and line text; scans for image syntax at cursor position; returns partial context + editor range.
- `imageSizeCalculator.ts` - Multi-strategy dimension fetching: content script (Android/Desktop) → base64 (Web/Desktop) → defaults. External images use DOM Image with CORS/privacy safeguards.
- `imageSyntaxBuilder.ts` - Generates Markdown/HTML output; preserves/escapes alt and optional title; applies width attribute for HTML with optional height attribute based on settings (preserves aspect ratio).
- `utils/stringUtils.ts` - Decode HTML entities on input; escape for HTML attributes and Markdown title.
- `utils/resourceUtils.ts` - Resource ID validation and base64 conversion for web app compatibility.
- `utils/toastUtils.ts` - Toast notification wrapper with setting-controlled display; respects `showToastMessages` setting.
- `logger.ts` - Centralized logging utility. Provides debug(), info(), warn(), and error() methods with configurable log levels (DEBUG, INFO, WARN, ERROR, NONE). Log level can be adjusted at runtime via browser console using `console.simpleImageResize.setLogLevel(level)` and `console.simpleImageResize.getLogLevel()`. Defaults to WARN level.
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

- Content script (`cursorContentScript.ts`) provides cross-platform cursor detection via custom CodeMirror commands.
- `detectImageAtCursor` uses content script to get cursor position and line text; scans for image syntax; returns partial context + `{ from, to }` range.
- `isOnImageInMarkdownEditor` gates the context menu by checking if cursor is on an image.
- Command uses cursor detection exclusively - user simply places cursor anywhere within the image line and invokes the command.
- `DialogLock` ensures only one resize dialog instance can be opened per editor session; additional invocations are ignored until the active dialog resolves or is cancelled.

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

- Input: decode entities from HTML (`&quot;`, `&apos;`, `&amp;`, etc.) so dialog shows plain text.
- Output escaping:
    - HTML attributes: escape `&`, `"`, `'` (as `&#39;`), `<`, `>`.
    - Markdown title (within quotes): escape `&`, `"`, `<`, `>`.

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

- `imageDetection` - Markdown/HTML detection, resource vs external, titles, escaped `)`.
- `imageSyntaxBuilder` - Markdown/HTML conversion, alt/title escaping/decoding, width/height emission (both widthAndHeight and widthOnly modes).
- `dialogHandler` - Initial state calculation for dialog based on syntax and resize mode.
- `dialogLock` - Lock acquisition and release behavior.

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
