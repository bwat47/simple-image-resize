# Simple Image Resize Plugin - Implementation Documentation

A Joplin plugin that provides a simple dialog interface for switching between image syntax formats (Markdown ↔ HTML) and resizing images by adjusting width/height attributes.

## Current Implementation Overview

### Architecture Summary

The plugin uses a **Command + Modal Dialog** pattern with the following key components:

```
src/
├── index.ts              # Main plugin registration, settings, and command logic
├── dialogHandler.ts      # Modal dialog with pure CSS-based field controls
├── imageDetection.ts     # Detects image syntax in selected text
├── imageSizeCalculator.ts # Gets original dimensions from Joplin resources
├── imageSyntaxBuilder.ts # Builds new HTML/Markdown syntax
├── constants.ts          # Regex patterns and settings keys
└── types.ts              # TypeScript interfaces
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

## Technical Implementation Details

### Image Detection Logic

```typescript
// Fixed regex state management - no global flags for single detection
MARKDOWN_IMAGE_FULL: /!\[(?<altText>[^\]]*)\]\(:\/(?<resourceId>[a-f0-9]{32})\)/i;
HTML_IMAGE_FULL: /<img\s+[^>]*src=["']:\/(?<resourceId>[a-f0-9]{32})["'][^>]*>/i;

// Multi-image detection uses global flags for counting
function hasMultipleImages(text: string): boolean {
    const markdownMatches = text.match(/!\[[^\]]*\]\(:\/{1,2}[a-f0-9]{32}\)/g) || [];
    const htmlMatches = text.match(/<img\s+[^>]*src=["']:\/[a-f0-9]{32}["'][^>]*>/g) || [];
    return markdownMatches.length + htmlMatches.length > 1;
}
```

### Dialog Field Control System

- **Hidden CSS Control Radios**: Use different names (`cssResizeMode`, `cssTargetSyntax`) for CSS targeting
- **Visible Form Radios**: Use standard names (`resizeMode`, `targetSyntax`) for form submission
- **JavaScript Sync**: Simple `onchange` handlers sync hidden controls for CSS styling

### CSS State Management

```css
/* Default state based on user preference */
$ {
    defaultresizemode==='percentage'?'absolute-size-row disabled' : 'percentage-row disabled';
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

- [x] Markdown ↔ HTML image syntax conversion
- [x] Percentage-based resizing with aspect ratio preservation
- [x] Absolute size resizing with auto-calculation when one dimension omitted
- [x] Alt text preservation and editing
- [x] Original image dimension detection from Joplin resources

### ✅ User Experience

- [x] Multi-image detection with helpful error messages
- [x] User preference for default resize mode
- [x] Clipboard-based workflow for safe operation
- [x] Context menu integration
- [x] Professional dialog with smooth animations
- [x] Responsive design for different screen sizes

### ✅ Technical Quality

- [x] TypeScript interfaces for type safety
- [x] Proper error handling and logging
- [x] Settings integration with Joplin preferences
- [x] Clean separation of concerns across modules
- [x] CSS-only field control without complex JavaScript

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

- **Markdown**: `![alt text](:/resourceId)`
- **HTML**: `<img src=":/resourceId" alt="alt text" width="200" height="150" />`

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

## File Structure Reference

```
simple-image-resize/
├── src/
│   ├── index.ts              # 🎯 Main plugin entry, settings, command logic
│   ├── dialogHandler.ts      # 🎨 Modal dialog with polished CSS controls
│   ├── imageDetection.ts     # 🔍 Smart syntax detection with multi-image validation
│   ├── imageSizeCalculator.ts # 📏 Dimension extraction from Joplin resources
│   ├── imageSyntaxBuilder.ts # 🔨 Clean output generation
│   ├── constants.ts          # ⚙️ Fixed regex patterns and settings
│   └── types.ts              # 📝 TypeScript interfaces
├── api/                      # Joplin API definitions
└── manifest.json             # Plugin metadata
```
