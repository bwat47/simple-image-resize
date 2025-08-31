## Project Structure

### File Organization (example)

```
src/
├── constants.ts          # All constants, regex patterns, settings keys
├── types.ts             # TypeScript interfaces and type definitions
├── utils.ts             # Validation functions and utilities
├── index.ts             # Main plugin entry point
├── [feature]Renderer.ts # Feature-specific logic (e.g., htmlRenderer.ts)
└── manifest.json        # Plugin metadata
```

## Design Principles

1. Follow best practices for clean, maintainable code
2. Don't overengineer: Simple beats complex
3. One way: One way to do things, not many
4. Clarity over compatibility: Clear code beats backward compatibility
5. Throw errors: Fail fast when preconditions aren't met
6. Separation of concerns: Each function should have a single responsibility

### Modularization:

Break down large classes/modules: If a class or module is growing beyond a manageable size, identify distinct responsibilities within it and extract them into separate, smaller classes or modules.

### Separation of Concerns

Ensure each file or module focuses on a single, well-defined purpose. For example, separate data access logic from business logic or presentation logic. Examples:

- **Constants**: Centralize all magic numbers, regex patterns, and configuration keys
- **Types**: Define all interfaces in a dedicated file for reusability
- **Utils**: Extract validation and utility functions for testability
- **Feature modules**: Separate complex logic into focused modules
- **Main entry**: Keep index.ts lean - just plugin registration and command binding

## Development Methodology

1. When possible, prefer minimal, focused fixes
2. Evidence-based debugging: Add minimal, targeted logging
3. Fix root causes: Address the underlying issue, not just symptoms
4. Simple > Complex: Let TypeScript catch errors instead of excessive runtime checks
5. Collaborative process: Work with user to identify most efficient solution

### Refactoring

Extract methods/functions: Identify blocks of code within a large method or function that perform a specific sub-task and extract them into their own, smaller methods or functions.

Consolidate duplicate code: Eliminate redundant code by creating reusable functions or classes.

### TypeScript Best Practices

#### Type Safety

```typescript
// ✅ Define comprehensive interfaces
export interface PlainTextOptions {
    preserveHeading: boolean;
    preserveEmphasis: boolean;
    preserveBold: boolean;
    hyperlinkBehavior: 'title' | 'url' | 'markdown';
}

// ✅ Validate external data with type guards
export function validatePlainTextSettings(settings: unknown): PlainTextOptions {
    const s = settings as Record<string, unknown>;
    return {
        preserveHeading: Boolean(s.preserveHeading),
        hyperlinkBehavior: ['title', 'url', 'markdown'].includes(String(s.hyperlinkBehavior))
            ? (String(s.hyperlinkBehavior) as HyperlinkBehavior)
            : 'title',
    };
}
```

#### Avoid the `any` Type:

- Use Specific Types: Define precise types for your variables, function parameters, and return values using interfaces, type aliases, or literal types.
- Prefer unknown over any: When dealing with values whose type is initially uncertain, such as data from an API or user input, use unknown.
- Leverage Type Inference: Allow TypeScript to infer types where possible.
- Utilize Generics: For functions or classes that operate on various types while maintaining type relationships, use generics.

### Interface Design

- Define interfaces for all complex data structures
- Use optional properties (`?`) appropriately
- Prefer union types over loose string types
- Create specific interfaces rather than using `any`

### Error Handling

#### Consistent Error Messages

```typescript
// ✅ Standardize error creation
function createResourceError(id: string, reason: string): string {
    return createErrorSpan(`Resource ":/${id}" ${reason}`);
}

// ✅ Provide fallbacks
try {
    const result = await riskyOperation();
    return result;
} catch (err) {
    console.error('[plugin-name] Operation failed:', err);
    const msg = err && err.message ? err.message : String(err);
    return createError(`Operation failed: ${msg}`);
}
```

#### Error Handling Patterns

- **Graceful degradation**: Gracefully handle errors and provide fallback behavior
- **User feedback**: Show meaningful toast messages for user-facing errors
- **Logging**: Use consistent prefixes like `[plugin-name]` in console logs
- **Error propagation**: Catch at appropriate levels, don't swallow errors silently

### Constants and Configuration

#### Centralized Constants

Use constants, avoid hardcoded magic numbers scattered throughout code

```typescript
// ✅ Group related constants
export const SETTINGS = {
    EMBED_IMAGES: 'embedImages',
    PRESERVE_HEADING: 'preserveHeading',
    HYPERLINK_BEHAVIOR: 'hyperlinkBehavior',
};

export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
    MIN_COLUMN_WIDTH: 3,
    DIMENSION_KEY_PREFIX: 'DIMENSION_',
};

// ✅ Document complex regex patterns
export const REGEX_PATTERNS = {
    // Matches HTML <img> tags with a Joplin resource ID in the src attribute
    // Group 1: All attributes up to the resource ID
    // Group 2: The 32-character Joplin resource ID
    HTML_IMG_WITH_RESOURCE: /<img([^>]*src=["']:\/{1,2}([a-f0-9]{32})["'][^>]*)>/gi,
};
```

### Settings Management

- Use string constants for all setting keys to avoid typos
- Provide sensible defaults for all settings
- Validate settings with dedicated functions
- Document setting purposes in both code and manifest

### Code Quality

#### Function Design

```typescript
// ✅ Single responsibility, clear naming
export function extractImageDimensions(
    markdown: string,
    embedImages: boolean
): { processedMarkdown: string; dimensions: Map<string, ImageDimensions> };

// ✅ Document complex functions
/**
 * Converts markdown-it tokens to plain text with formatting options.
 * @param tokens The markdown-it token array to process
 * @param options Configuration for preserving/removing formatting
 * @returns Clean plain text string
 */
export function renderPlainText(tokens: Token[], options: PlainTextOptions): string;
```

#### Validation Patterns

```typescript
// ✅ Dedicated validation functions
function validateResourceId(id: string): boolean {
    return !!id && typeof id === 'string' && /^[a-f0-9]{32}$/i.test(id);
}

// ✅ Early returns for validation
if (!validateResourceId(id)) {
    return createResourceError(id, 'is not a valid Joplin resource ID.');
}
```

#### Advanced Reusable Utilities

- For complex, recurring problems (e.g., handling diverse external library patterns), create dedicated utility modules (e.g., `pluginUtils.ts`).
- This encapsulates complex logic and promotes reuse across the plugin or even future plugins.

#### Documentation Standards

- Use JSDoc for complex functions
- Comment architectural decisions
- Document regex patterns with examples
- Explain non-obvious business logic

## Joplin-Specific Patterns

### Plugin Registration

```typescript
joplin.plugins.register({
    onStart: async function () {
        // 1. Register settings section
        await joplin.settings.registerSection('pluginName', {
            label: 'Plugin Display Name',
            iconName: 'fas fa-icon',
        });

        // 2. Register individual settings
        await joplin.settings.registerSettings({
            [SETTINGS.SOME_SETTING]: {
                value: defaultValue,
                type: SettingItemType.Bool,
                section: 'pluginName',
                public: true,
                label: 'Human readable label',
                description: 'Detailed explanation of what this does.',
            },
        });

        // 3. Register commands
        // 4. Register keyboard shortcuts
    },
});
```

### Command Implementation

```typescript
// ✅ Consistent command structure
await joplin.commands.register({
    name: 'commandName',
    label: 'Human Readable Command Name',
    iconName: 'fas fa-icon',
    when: 'markdownEditorVisible', // Appropriate context
    execute: async () => {
        try {
            // Get selection/input
            const selection = await joplin.commands.execute('editor.execCommand', {
                name: 'getSelection',
            });

            if (!selection) {
                await joplin.views.dialogs.showToast({
                    message: 'No text selected.',
                    type: ToastType.Info,
                });
                return;
            }

            // Process data
            const result = await processData(selection);

            // Output result
            await joplin.clipboard.writeText(result);

            // User feedback
            await joplin.views.dialogs.showToast({
                message: 'Operation completed!',
                type: ToastType.Success,
            });
        } catch (err) {
            console.error('[plugin-name] Error:', err);
            await joplin.views.dialogs.showToast({
                message: 'Operation failed: ' + (err?.message || err),
                type: ToastType.Error,
            });
        }
    },
});
```

### Add context menu items only for Markdown Editor

```typescript
joplin.workspace.filterEditorContextMenu(async (contextMenu) => {
    // Debug: log what we see in the context menu
    console.log(
        '[copy-as-html] Context menu items:',
        contextMenu.items.map((item) => item.commandName)
    );

    // Simple approach: try to execute a markdown-specific command
    // If it succeeds, we're in the markdown editor
    let isMarkdownEditor = false;
    try {
        // Try to get the cursor position - this should only work in markdown editor
        await joplin.commands.execute('editor.execCommand', {
            name: 'getCursor',
        });
        isMarkdownEditor = true;
        console.log('[copy-as-html] Detected markdown editor - adding context menu items');
    } catch {
        // If getCursor fails, we're likely in rich text editor
        isMarkdownEditor = false;
        console.log('[copy-as-html] Detected rich text editor - not adding context menu items');
    }

    // Only add our commands to the context menu if we're in markdown editor
    if (isMarkdownEditor) {
        // Check if our commands are already in the menu to avoid duplicates
        const hasHtmlCommand = contextMenu.items.some((item) => item.commandName === 'copyAsHtml');
        const hasPlainTextCommand = contextMenu.items.some((item) => item.commandName === 'copyAsPlainText');

        if (!hasHtmlCommand) {
            contextMenu.items.push({
                commandName: 'copyAsHtml',
                label: 'Copy selection as HTML',
                accelerator: 'Ctrl+Shift+C',
            });
        }

        if (!hasPlainTextCommand) {
            contextMenu.items.push({
                commandName: 'copyAsPlainText',
                label: 'Copy selection as Plain Text',
                accelerator: 'Ctrl+Alt+C',
            });
        }

        console.log('[copy-as-html] Added context menu items, total:', contextMenu.items.length);
    }

    return contextMenu;
});
```

## Performance Considerations

### Resource Management

- Use timeouts for potentially long-running operations
- Consider memory usage with large data processing
- Avoid blocking the UI thread for intensive operations
- Use caching or deduplication for resource-intensive operations (e.g., fetching the same resource multiple times in a single operation).
- Clean up resources (event listeners, intervals) appropriately

### Async Patterns

```typescript
/**
 * Simple timeout wrapper that ensures cleanup
 */
async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Operation timed out'
): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutId);
    }
}
```

## Build and Development

### Standardized Scripts

- Standardize build, linting, and formatting scripts in `package.json`.
- Use common names like `dist` (for building the plugin), `lint` (for checking code quality), and `format` (for auto-formatting).
- This promotes a consistent development environment across projects.

## Testing and Maintenance

### Code Organization for Testing

- Extract pure functions that can be unit tested
- Avoid tightly coupling to Joplin APIs in business logic
- Keep side effects isolated

### Maintainability Practices

- Prefer explicit over clever code
- Use meaningful variable and function names
- Keep functions focused and small
- Avoid premature optimization

### Testing

- Create unit tests to cover primary functionality
- Watch it fail - Ensure the test actually tests something
- Write minimal code - Just enough to make the test pass
- Refactor - Improve code while keeping tests green

## Common Pitfalls to Avoid

### Don't Over-Engineer

- ❌ Complex inheritance hierarchies for simple plugins
- ❌ Unnecessary abstraction layers
- ❌ Generic solutions for specific problems
- ✅ Keep complexity proportional to requirements

### Settings Best Practices

- ❌ Unvalidated user input from settings
- ✅ Single source of truth, validation, graceful degradation

## Communication

- When giving feedback, explain thought process and highlight issues and opportunities.

## Final Principles

1. **Robustness**: Handle edge cases and provide fallbacks
2. **User Experience**: Clear error messages and appropriate feedback
3. **Maintainability**: Code should be easy to understand and modify
4. **TypeScript**: Use the type system to prevent runtime errors
5. **Documentation**: Code should be self-documenting with strategic comments
6. **Consistency**: Establish patterns and stick to them throughout the plugin
7. **Appropriate Complexity**: Keep solutions proportional to the problem size
