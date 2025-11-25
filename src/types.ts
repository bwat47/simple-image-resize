export interface ImageDimensions {
    width: number;
    height: number;
}

export interface ImageContext {
    type: 'markdown' | 'html';
    syntax: string;
    source: string; // Can be resourceId or external URL
    sourceType: 'resource' | 'external';
    altText: string;
    title?: string;
    // The original, detected dimensions of the image
    originalDimensions: ImageDimensions;
}

export interface ResizeDialogResult {
    targetSyntax: 'markdown' | 'html';
    altText: string;
    // Resize options
    resizeMode: 'percentage' | 'absolute';
    percentage?: number;
    absoluteWidth?: number;
    absoluteHeight?: number;
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
    type: 'markdown' | 'html';
    syntax: string;
    source: string;
    sourceType: 'resource' | 'external';
    altText: string;
    title: string;
    range: EditorRange;
}
