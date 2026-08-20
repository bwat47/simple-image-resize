export type ImageSyntax = 'markdown' | 'html';

export type ResizeMode = 'percentage' | 'absolute';

export interface ImageDimensions {
    width: number;
    height: number;
}

export interface ImageContext {
    type: ImageSyntax;
    syntax: string;
    source: string; // Can be resourceId or external URL
    sourceType: 'resource' | 'external';
    altText: string;
    title?: string;
    // The original, detected dimensions of the image
    originalDimensions: ImageDimensions;
}

export interface ResizeDialogResult {
    targetSyntax: ImageSyntax;
    altText: string;
    // Resize options
    resizeMode: ResizeMode;
    percentage?: number;
    absoluteWidth?: number;
    absoluteHeight?: number;
}

export interface ResizeDialogConfig {
    defaultResizeMode: ResizeMode;
    defaultPercentage: number;
    originalWidth: number;
    originalHeight: number;
}

/** Precomputed CSS classes and HTML attributes used to render the resize dialog's initial state. */
export interface InitialDialogState {
    // CSS classes
    resizeFieldsetClass: string;
    percentageRowClass: string;
    absoluteGroupClass: string;
    // HTML checked attributes
    htmlCheckedAttr: string;
    markdownCheckedAttr: string;
    percentageModeCheckedAttr: string;
    absoluteModeCheckedAttr: string;
    // HTML disabled attributes
    percentageDisabledAttr: string;
    absoluteDisabledAttr: string;
}

// New types for cursor-based detection
export interface EditorPosition {
    line: number;
    ch: number;
}

export interface EditorRange {
    from: EditorPosition;
    to: EditorPosition;
}

export interface EditorImageAtCursorResult {
    type: ImageSyntax;
    syntax: string;
    source: string;
    sourceType: 'resource' | 'external';
    altText: string;
    title: string;
    range: EditorRange;
}
