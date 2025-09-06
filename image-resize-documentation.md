# Simple Image Resize Plugin - Implementation Documentation

A Joplin plugin that provides a simple dialog interface for switching between image syntax formats (Markdown ↔ HTML) and resizing images by adjusting width/height attributes.

## Current Implementation Overview

### Architecture Summary

The plugin uses a **Command + Modal Dialog** pattern with the following key components:

```
simple-image-resize/
├── src/
│   ├── index.ts               # 🎯 Main plugin entry, settings, command logic
│   ├── dialogHandler.ts       # 🎨 Modal dialog with polished CSS controls
│   ├── imageDetection.ts      # 🔍 Smart syntax detection (resource/external; title/alt decode)
│   ├── imageSizeCalculator.ts # 📏 Dimension extraction via Imaging API + fallbacks
│   ├── imageSyntaxBuilder.ts  # 🔨 Output generation (preserve/escape alt/title)
│   ├── selectionValidation.ts # ✅ Single-image validation helpers
│   ├── stringUtils.ts         # 🔣 Escaping/decoding helpers
│   ├── utils.ts               # 🧰 Joplin-specific helpers (resource base64, etc.)
│   ├── constants.ts           # ⚙️ Regex patterns and settings
│   └── types.ts               # 📝 TypeScript interfaces
├── tests/                     # 🧪 Jest tests (detection, builder, validation)
├── api/                       # Joplin API definitions
└── manifest.json              # Plugin metadata
```

### Key Design Decisions Made

#### 1. User Experience Pattern: **Clipboard-Based Workflow**

- **Choice**: Copy resized syntax to clipboard rather than direct editor replacement
- **Rationale**: Avoids race conditions, gives users control, safer approach
- **User Flow**: Select image → Run command → Dialog opens → Configure → New syntax copied to clipboard → Paste to replace

#### 2. Dialog Implementation: **Pure CSS + Minimal JavaScript**

- **Choice**: CSS-only field disable/enable logic with simple JavaScript synchronization
- **Avoided**: Complex CodeMirror extensions, heavy JavaScript state management
- **Benefits**: Reliable, works in Joplin's dialog environment, smooth transitions

#### 3. Multi-Image Detection: **Smart Input Validation**

- **Implementation**: Detects multiple images in selection and provides clear error messages
- **User Messages**:
    - Empty selection: "Please select an image syntax to resize."
    - Multiple images: "Multiple images found. Please select a single image syntax."
    - Invalid syntax: "No valid image syntax found. Please select ![...](:/...) or <img src=":/..." ...>"

#### 4. Settings Integration: **Default Resize Mode Preference**

- **Setting**: "Default resize mode" (Percentage/Absolute size)
- **Location**: Joplin Settings → Plugins → Simple Image Resize
- **Behavior**: Dialog opens with user's preferred mode pre-selected

#### 5. Visual Design: **Polished CSS with Smooth Transitions**

- **Animations**: 200ms ease transitions for opacity and background changes
- **Accessibility**: Proper cursor states (pointer, not-allowed, text)
- **Code Examples**: Styling with monospace fonts and backgrounds
- **Responsive**: Adapts from small laptops (480px) to 4K monitors (680px+)

#### 6. Editor Scope: **Markdown-only Context Menu**

- **Choice**: Only offer the command in the Markdown editor by dynamically filtering the context menu.
- **Rationale**: Avoids confusion in rich text editor contexts.
- **Mechanics**: We probe the Markdown editor via a safe command (e.g., getCursor) inside `workspace.filterEditorContextMenu`.

#### 7. Title and Alt Handling: **Preserve, Decode, and Escape**

- **Preservation**: Title is round-tripped between Markdown and HTML.
- **Decode on Input**: HTML entities in alt/title (e.g., `&quot;`, `&apos;`) are decoded when reading HTML so the dialog and Markdown show plain text.
- **Escape on Output**:
    - HTML attributes: escape `&`, `"`, `'` (to `&#39;`), `<`, `>`.
    - Markdown title (inside `"..."`): escape `&`, `"`, `<`, `>`.
- **Outcome**: Alt/title text isn’t lost; quotes and apostrophes render correctly in the dialog and output.

#### 8. External Images: **http(s) URL Support**

- **Detection**: Regex supports external URLs in both Markdown and HTML.
- **Behavior**: External images are treated similarly to resources for sizing and conversion.

#### 9. Image Dimensions: **Imaging API + Fallbacks**

- **Primary**: Joplin Imaging API for both resources and external URLs.
- **Fallbacks**:
    - Resource: Convert to base64 and probe with DOM `Image` when Imaging returns 0×0/invalid (helps with certain formats like WEBP).
    - External: Probe with DOM `Image` using `crossOrigin='anonymous'` and `referrerPolicy='no-referrer'`.
- **Timeouts & Defaults**: External probes have longer timeouts; failed external sizing defaults to 400×300 to keep UX flowing.

#### 10. Privacy

- External probes avoid sending referrers and use anonymous CORS to minimize leakage.

## Technical Implementation Details

### Image Detection Logic

```typescript
// Single-detection (no global flag). Supports resource or external URLs, escaped ')' in URLs, and optional titles.
const MARKDOWN_IMAGE_FULL =
    /!\[(?<altText>[^\]]*)\]\(\s*(?::\/(?<resourceId>[a-f0-9]{32})|(?<url>https?:\/\/(?:\\\)|[^)\s])+))\s*(?:"(?<titleDouble>[^"]*)"|'(?<titleSingle>[^']*)')?\s*\)/i;

// HTML single-detection supports resource or external src
const HTML_IMAGE_FULL = /<img\s+[^>]*src=["'](?::\/(?<resourceId>[a-f0-9]{32})|(?<url>https?:\/\/[^"']+))["'][^>]*>/i;

// Attribute extraction uses quote-aware backreferences (group 2 is the attribute value)
const IMG_ALT = /\balt\s*=\s*(["'])(.*?)\1/i;
const IMG_TITLE = /\btitle\s*=\s*(["'])(.*?)\1/i;

// Multi-image/global counting uses global variants
const ANY_IMAGE_GLOBAL = /(?:!\[[^\]]*\]\([^)]*\))|(?:<img\s+[^>]*>)/gi;
```

### Dialog Field Control System

- **Hidden CSS Control Radios**: Use different names (`cssResizeMode`, `cssTargetSyntax`) for CSS targeting
- **Visible Form Radios**: Use standard names (`resizeMode`, `targetSyntax`) for form submission
- **JavaScript Sync**: Simple `onchange` handlers sync hidden controls for CSS styling

### CSS State Management

```css
/* Default state based on user preference */
$ {
    defaultresizemode==='percentage'?'absolute-size-row disabled': 'percentage-row disabled';
}

/* Bidirectional switching support */
#modePercent:checked ~ .resize-fieldset .percentage-row {
    /* enabled */
}
#modeAbsolute:checked ~ .resize-fieldset .absolute-size-row {
    /* enabled */
}

/* Markdown mode disables entire resize section */
#syntaxMarkdown:checked ~ form .resize-fieldset {
    /* disabled */
}
```

### Error Handling & User Feedback

```typescript
try {
    const defaultResizeMode = await joplin.settings.value('imageResize.defaultResizeMode');
    const originalDimensions = await getOriginalImageDimensions(partialContext.resourceId);
    // ... process dialog
    await joplin.clipboard.writeText(newSyntax);
    await joplin.views.dialogs.showToast({
        message: 'Resized image syntax copied to clipboard! Paste to replace the original.',
        type: ToastType.Success,
    });
} catch (err) {
    console.error('[Image Resize] Error:', err);
    const message = err?.message || 'Unknown error occurred';
    await joplin.views.dialogs.showToast({
        message: `Operation failed: ${message}`,
        type: ToastType.Error,
    });
}
```

## Features Implemented

### ✅ Core Functionality

- [x] Markdown ↔ HTML image syntax conversion (preserves alt and optional title)
- [x] Percentage-based resizing with aspect ratio preservation
- [x] Absolute size resizing with auto-calculation when one dimension omitted
- [x] Alt text preservation and editing (decode entities on input; escape on output)
- [x] Title preservation and editing (Markdown ↔ HTML)
- [x] Original image dimension detection via Joplin Imaging API with fallbacks
- [x] External http(s) image support

### ✅ User Experience

- [x] Multi-image detection with helpful error messages
- [x] User preference for default resize mode
- [x] Clipboard-based workflow for safe operation
- [x] Context menu integration (Markdown editor only)
- [x] Professional dialog with smooth animations
- [x] Responsive design for different screen sizes

### ✅ Technical Quality

- [x] TypeScript interfaces for type safety
- [x] Proper error handling and logging
- [x] Settings integration with Joplin preferences
- [x] Clean separation of concerns across modules (detection, builder, validation, imaging, escaping)
- [x] CSS-only field control without complex JavaScript
- [x] Unit tests (Jest + ts-jest) for detection, builder, and validation

## Plugin Settings

| Setting                 | Default    | Description                                                               |
| ----------------------- | ---------- | ------------------------------------------------------------------------- |
| **Default resize mode** | Percentage | Controls which resize mode is selected by default when opening the dialog |

## Usage Instructions

1. **Select image syntax** in the Joplin editor (Markdown or HTML format)
2. **Right-click** and choose "Resize Image" or use the command palette
3. **Configure resize options**:
    - Choose output syntax (HTML supports resizing, Markdown original size only)
    - Select resize mode (Percentage or Absolute size)
    - Adjust alt text if needed
4. **Click OK** - New syntax is copied to clipboard
5. **Paste** to replace the original image syntax

## Supported Image Formats

- **Markdown (resource)**: `![alt](:/resourceId)`
- **Markdown (external)**: `![alt](https://example.com/image.png "optional title")`
- **HTML (resource)**: `<img src=":/resourceId" alt="alt" width="200" height="150" title="optional" />`
- **HTML (external)**: `<img src="https://example.com/image.png" alt="alt" width="200" height="150" title="optional" />`

Notes

- Markdown URLs support escaped right-paren `)` via `%29` or a backslash escape in the regex.
- Titles are optional and preserved when converting formats.
- HTML alt/title values are decoded from entities (e.g., `&quot;`, `&apos;`) before showing in the dialog or emitting Markdown.
- HTML output escapes `&`, `"`, `'` (as `&#39;`), `<`, and `>` in alt/title attributes.

## Browser/Environment Compatibility

- ✅ **Joplin Desktop**: Full functionality
- ✅ **Joplin Mobile**: Not tested
- ✅ **Different screen sizes**: Responsive from 480px to 4K monitors
- ✅ **Accessibility**: Proper cursor states and visual feedback

## Development Approach & Lessons Learned

### Why This Approach Works Well

1. **Simplicity**: Clean, maintainable code without over-engineering
2. **Reliability**: Uses well-established Joplin APIs and standard web technologies
3. **User Control**: Clipboard workflow gives users full control over changes
4. **Performance**: Minimal JavaScript, efficient CSS transitions
5. **Scalability**: Easy to extend with new features or settings

### Key Technical Decisions

#### CSS-Only Field Control

- **Problem**: JavaScript in Joplin dialogs has limitations
- **Solution**: Pure CSS with hidden radio buttons for styling, minimal JS for synchronization
- **Result**: Smooth transitions, reliable state management

#### Multi-Image Validation

- **Problem**: Users selecting large text blocks with multiple images
- **Solution**: Upfront validation with clear, actionable error messages
- **Result**: Better user experience, prevents confusion

### Future Enhancement Possibilities

- **Batch processing**: Handle multiple images in one operation
- **Image preview**: Show thumbnail in dialog
- **Custom presets**: Save frequently used resize settings
- **Keyboard shortcuts**: Quick resize options
- **Export formats**: Additional output syntax formats (e.g. markdown with pandoc notation).
