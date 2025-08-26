// In types.ts
export interface ImageDimensions {
    width: number;
    height: number;
}

export interface ImageContext {
    type: 'markdown' | 'html';
    syntax: string;
    resourceId: string;
    altText: string;
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
