## Architecture Overview

### Plugin Type: Command + Modal Dialog (Implemented)

Current implementation intentionally favors the simpler, more robust pattern:

- **Main plugin**: Handles command registration, dialog UI, clipboard output
- **Inline dialog script**: Manages form logic (percentage vs absolute size)
- **No content script / CodeMirror extension**: Deferred unless future precision needs arise

## Implementation Plan

### 1. Project Structure

```
src/
├── constants.ts           # Regex patterns, settings keys (trimmed)
├── types.ts               # Shared TypeScript interfaces
├── utils.ts               # Validation and utility helpers
├── imageDetection.ts      # Detect image syntax at cursor / selection
├── imageSizeCalculator.ts # Get original dimensions from resource
├── dialogHandler.ts       # Builds & shows resize dialog (inline JS)
├── imageSyntaxBuilder.ts  # Builds new HTML/Markdown image syntax
├── index.ts               # Main plugin registration & command
└── manifest.json
```

Removed during simplification:

- `contentScript.ts` (not needed; no CodeMirror extension yet)
- `editorModifier.ts` (renamed to `imageSyntaxBuilder.ts`)

### 2. Key Technical Challenges & Solutions

#### Challenge 1: Context Menu Conditional Display

**Problem**: Show "Resize Image" only when cursor is on an image

**Solution**: Use CodeMirror's context detection:

```typescript
// In contentScript.ts
function isOnImageSyntax(cm: any, pos: any): ImageContext | null {
    const line = cm.getLine(pos.line);
    const cursor = pos.ch;

    // Check for markdown image: ![alt](:/resourceId)
    const markdownMatch = line.match(REGEX_PATTERNS.MARKDOWN_IMAGE_FULL);
    if (markdownMatch && cursor >= markdownMatch.index && cursor <= markdownMatch.index + markdownMatch[0].length) {
        return {
            type: 'markdown',
            syntax: markdownMatch[0],
            resourceId: markdownMatch.groups.resourceId,
            altText: markdownMatch.groups.altText,
            range: { start: markdownMatch.index, end: markdownMatch.index + markdownMatch[0].length },
        };
    }

    // Check for HTML image: <img src=":/resourceId" ... >
    const htmlMatch = line.match(REGEX_PATTERNS.HTML_IMAGE_FULL);
    // Similar logic...

    return null;
}
```

#### Challenge 2: Getting Original Image Dimensions

**Problem**: Need actual image dimensions to calculate percentages

**Solution**: Use Joplin's resource API (similar to your existing plugin):

```typescript
// In imageSizeCalculator.ts
export async function getOriginalDimensions(resourceId: string): Promise<{ width: number; height: number }> {
    try {
        const resource = await joplin.data.get(['resources', resourceId]);
        if (!resource.mime.startsWith('image/')) {
            throw new Error('Resource is not an image');
        }

        const fileData = await joplin.data.get(['resources', resourceId, 'file']);

        // Use image-size library or similar to get dimensions
        const dimensions = await getImageSize(fileData);
        return dimensions;
    } catch (err) {
        throw new Error(`Failed to get image dimensions: ${err.message}`);
    }
}
```

### 3. Dialog Design

Create a modal with these sections:

```typescript
interface ResizeDialogData {
    currentSyntax: 'markdown' | 'html';
    targetSyntax: 'markdown' | 'html';
    originalDimensions: { width: number; height: number };
    resizeMode: 'percentage' | 'absolute';
    percentage?: number;
    absoluteWidth?: number;
    absoluteHeight?: number;
    // (Removed) maintainAspectRatio: boolean; // Replaced by fallback: leave one dimension blank to auto-compute
    altText: string;
}
```

**Dialog Sections**:

1. **Syntax Selection**: Radio buttons for Markdown vs HTML

2. Resize Options

    (only when HTML selected):
    - Radio buttons: "Resize by percentage" / "Set absolute size"
    - Percentage input (with preview of calculated pixels)
    - Width/Height inputs (with aspect ratio lock checkbox)

3. **Alt Text**: Text input for alt attribute

4. **Preview**: Show before/after syntax

### 4. Constants & Regex Patterns

```typescript
// In constants.ts
export const REGEX_PATTERNS = {
    // ![alt text](:/32charresourceid)
    MARKDOWN_IMAGE_FULL: /!\[(?<altText>[^\]]*)\]\(:\/(?<resourceId>[a-f0-9]{32})\)/gi,

    // <img src=":/resourceid" ... >
    HTML_IMAGE_FULL: /<img\s+[^>]*src=["']:\/(?<resourceId>[a-f0-9]{32})["'][^>]*>/gi,

    // Extract existing width/height from HTML img
    IMG_WIDTH: /\bwidth\s*=\s*["']?(\d+)["']?/i,
    IMG_HEIGHT: /\bheight\s*=\s*["']?(\d+)["']?/i,
    IMG_ALT: /\balt\s*=\s*["']([^"']*)["']/i,
};

export const SETTINGS = {
    DEFAULT_RESIZE_MODE: 'defaultResizeMode',
    DEFAULT_SYNTAX: 'defaultSyntax',
    // (MAINTAIN_ASPECT_RATIO removed; aspect ratio derived automatically when one dimension omitted)
};
```

### 5. Editor Integration Strategy

**Two approaches considered (historical analysis retained)**:

#### Option A: CodeMirror Plugin (Deferred)

- Full CodeMirror extension with proper cursor detection
- Better integration with editor state
- More complex setup

#### Option B: Joplin Command + Text Manipulation (Simpler)

- Use `editor.getSelection()` and `editor.replaceSelection()`
- Detect image syntax in selected text
- Simpler but less precise cursor detection

I'd recommend **Option B** initially for faster development, similar to your Copy as HTML plugin pattern:

```typescript
// In index.ts
await joplin.commands.register({
    name: 'resizeImage',
    label: 'Resize Image',
    iconName: 'fas fa-expand-alt',
    when: 'markdownEditorVisible',
    execute: async () => {
        try {
            // Get current cursor position and surrounding text
            const selection = await joplin.commands.execute('editor.execCommand', {
                name: 'getSelection',
            });

            // If no selection, get current line
            const currentLine = selection || (await getCurrentLine());

            const imageContext = detectImageSyntax(currentLine);
            if (!imageContext) {
                await joplin.views.dialogs.showToast({
                    message: 'Cursor is not on an image. Place cursor on image syntax.',
                    type: ToastType.Info,
                });
                return;
            }

            // Open resize dialog
            const result = await showResizeDialog(imageContext);
            if (result) {
                await replaceImageSyntax(imageContext, result);
            }
        } catch (err) {
            console.error('[image-resize] Error:', err);
            await joplin.views.dialogs.showToast({
                message: 'Failed to resize image: ' + err.message,
                type: ToastType.Error,
            });
        }
    },
});
```

## Recommended Development Phases

### Phase 1: Basic Structure

1. Set up project structure following your guidelines
2. Implement basic image syntax detection (markdown ↔ HTML)
3. Create simple modal dialog
4. Implement basic syntax switching (no resizing yet)

### Phase 2: Size Calculation

1. Add image dimension detection from Joplin resources
2. Implement percentage-based resizing
3. Add absolute size inputs with aspect ratio maintenance

### Phase 3: Polish

1. Add better cursor detection
2. Improve error handling
3. Add settings for default behaviors
4. Consider upgrading to full CodeMirror plugin if needed

### Phase 4: Context Menu Integration

1. Investigate if conditional context menus are possible
2. Fallback to keyboard shortcut if not feasible

## Potential Limitations

1. **Context Menu Limitations**: Joplin might not support conditional context menus based on cursor position
2. **Cursor Detection**: Without full CodeMirror integration, cursor detection might be imprecise
3. **Image Format Support**: Some image formats might not provide dimension metadata

## Alternative UI Approaches

If context menu proves problematic:

1. **Command Palette**: Users type "Resize Image"
2. **Keyboard Shortcut**: Default shortcut when cursor on image
3. **Toolbar Button**: Always visible but shows error if not on image

Would you like me to elaborate on any of these aspects or start with a specific implementation approach?

Great question! Let me break down the pros and cons of each approach specifically for your image resize plugin:

## Option A: Full CodeMirror Extension

### Pros

**1. Precise Cursor Detection**

```typescript
// Can detect exact cursor position within image syntax
function onCursorActivity(cm: any) {
    const cursor = cm.getCursor();
    const imageContext = isOnImageSyntax(cm, cursor);

    if (imageContext) {
        // Enable context menu or highlight the image syntax
        showImageControls(imageContext);
    }
}
```

- **Perfect for this use case**: Knows exactly when cursor is within `![alt](:/resourceId)` bounds
- **Real-time feedback**: Could highlight image syntax when cursor hovers over it
- **Context menu accuracy**: Only show "Resize Image" when actually positioned on an image

**2. Advanced Editor Integration**

- **Multi-line image detection**: Can handle HTML `<img>` tags that span multiple lines
- **Syntax highlighting**: Could add custom styling for resizable images
- **Live preview**: Could show dimension tooltips on hover

**3. Better UX Possibilities**

- **Visual indicators**: Highlight images that can be resized
- **Inline controls**: Potentially add resize handles directly in the editor
- **Smart selection**: Auto-select entire image syntax when user clicks "resize"

### Cons

**1. Complexity & Development Time**

```typescript
// Requires understanding CodeMirror internals
const extension = EditorView.theme({
    '.cm-imageHighlight': {
        backgroundColor: 'rgba(0, 100, 200, 0.1)',
        borderRadius: '3px',
    },
});

const imageHighlighter = ViewPlugin.fromClass(
    class {
        constructor(view: EditorView) {
            this.view = view;
            this.decorations = this.computeDecorations(view);
        }
        // Complex decoration logic...
    }
);
```

- **Steep learning curve**: Need to understand CodeMirror 6 API deeply
- **More moving parts**: Would introduce content script / extension complexity (intentionally avoided so far)
- **Debugging complexity**: Harder to troubleshoot editor integration issues

**2. Joplin API Limitations**

- **Plugin API constraints**: Joplin's CodeMirror integration might not expose all needed APIs
- **Version compatibility**: More likely to break with Joplin updates
- **Documentation gaps**: Less documented than standard plugin commands

**3. Maintenance Overhead**

- **Complex state management**: Need to track cursor position, image contexts, UI state
- **Event handling**: Multiple event listeners for cursor movement, text changes, etc.

## Option B: Command-Based with Text Manipulation

### Pros

**1. Simplicity & Reliability**

```typescript
await joplin.commands.register({
    name: 'resizeImage',
    execute: async () => {
        // Simple, well-documented API usage
        const selection = await joplin.commands.execute('editor.execCommand', {
            name: 'getSelection',
        });

        // Straightforward text processing
        const imageMatch = findImageInText(selection);
        if (imageMatch) {
            await processImageResize(imageMatch);
        }
    },
});
```

- **Proven pattern**: Follows the same approach as your successful Copy as HTML plugin
- **Stable APIs**: Uses well-established Joplin plugin APIs
- **Easy debugging**: Standard JavaScript text processing

**2. Faster Development**

- **Familiar territory**: You already know this pattern works well
- **Less boilerplate**: No complex editor integration setup
- **Incremental development**: Can build and test features piece by piece

**3. Better Error Handling**

```typescript
// Clear error boundaries
try {
    const imageContext = detectImageSyntax(text);
    const newSyntax = await processResize(imageContext);
    await replaceText(newSyntax);
} catch (err) {
    // Simple, predictable error handling
    showUserError(err.message);
}
```

### Cons

**1. Imprecise Context Detection**

```typescript
// Can only work with selected text or current line
const currentLine = await getCurrentLine(); // Entire line, not cursor position
const selection = await getSelection(); // Only if user selected text

// Problems:
// - Can't tell if cursor is specifically on the image
// - Might detect multiple images in one line
// - User must remember to select or position cursor correctly
```

**2. User Experience Limitations**

- **Manual positioning**: User must select image text or position cursor on the correct line
- **No visual feedback**: Can't highlight which images are resizable
- **Context menu issues**: Can't conditionally show menu items based on cursor position
- **Error-prone**: Easy for users to accidentally trigger on wrong content

**3. Multi-line Challenges**

```html
<!-- This HTML img might span multiple lines -->
<img src=":/3c8c5a708b864c24b942e85f44d0f9b9" alt="Alt Text" width="361" class="jop-noMdConv" />
```

- **Line-based detection fails**: Can't reliably detect multi-line HTML images
- **Selection complexity**: User would need to select entire multi-line syntax

## Recommendation & Current Status

Implemented **Option B** (command-based) first; CodeMirror (Option A) reserved for future enhancement if precise cursor-bound activation or inline decorations become necessary.

### Phase 1: Option B Implementation (Completed)

```typescript
// Start simple - works for 90% of use cases
await joplin.commands.register({
    name: 'resizeImage',
    label: 'Resize Image',
    execute: async () => {
        // Get current line or selection
        const text = await getCurrentContext();

        // Find image in text
        const imageMatch = findImageSyntax(text);

        if (!imageMatch) {
            await joplin.views.dialogs.showToast({
                message: 'No image found. Please place cursor on an image line or select image text.',
                type: ToastType.Info,
            });
            return;
        }

        // Process normally
        await handleImageResize(imageMatch);
    },
});
```

**Benefits**:

- Get working plugin quickly
- Learn the domain requirements
- Gather user feedback
- Prove the concept

### Phase 2: (Future) Upgrade to Option A (If Needed)

Based on user feedback, if cursor precision becomes a major issue:

```typescript
// Add CodeMirror extension for better detection
const imageResizeExtension = {
    key: 'imageResize',
    init: (codeMirror: any) => {
        codeMirror.on('cursorActivity', handleCursorActivity);
        codeMirror.on('contextmenu', handleContextMenu);
    },
};
```

## Specific Implementation Strategy

### Rationale for Staying with Option B (Current Choice)

1. **Clear User Instructions**: Document that users should click on the image line
2. **Smart Detection**: Make the text detection as forgiving as possible
3. **Fallback Handling**: Gracefully handle multiple images per line

```typescript
function findImageSyntax(text: string): ImageContext | null {
    // Try to find any image syntax in the text
    const markdownMatch = text.match(REGEX_PATTERNS.MARKDOWN_IMAGE);
    const htmlMatch = text.match(REGEX_PATTERNS.HTML_IMAGE);

    if (markdownMatch && htmlMatch) {
        // Multiple images - ask user to select specific image text
        throw new Error('Multiple images found. Please select the specific image text.');
    }

    return markdownMatch ? parseMarkdownImage(markdownMatch) : htmlMatch ? parseHtmlImage(htmlMatch) : null;
}
```

### The Deciding Factors

Choose **Option A later** if:

- User testing shows cursor precision is critical
- You want advanced features (hover effects, visual indicators)
- You're comfortable with the complexity

Stick with **Option B** (current) if:

- You want to ship quickly and iterate
- The simple approach meets user needs
- You prefer maintainable, predictable code

Given your success with Copy as HTML using Option B patterns, I'd recommend starting there and upgrading only if user feedback demands the precision of Option A.
