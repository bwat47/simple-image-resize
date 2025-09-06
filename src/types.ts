// In types.ts
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
    // The full text of the user's original selection
    originalSelection: string;
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
