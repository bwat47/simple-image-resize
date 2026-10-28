export type ImageSyntax = 'markdown' | 'html';

export type ResizeMode = 'percentage' | 'absolute';

export type HtmlSyntaxStyle = 'widthAndHeight' | 'widthOnly';

export interface ImageDimensions {
    width: number;
    height: number;
}

export interface OriginalImageDimensionsResult {
    dimensions: ImageDimensions;
    determined: boolean;
}

export type ImageSourceType = 'resource' | 'external';

/** An image embed as found in the note source. */
export interface ImageDetails {
    type: ImageSyntax;
    syntax: string;
    source: string; // Can be resourceId or external URL
    sourceType: ImageSourceType;
    altText: string;
    title: string;
}

export interface ImageContext extends ImageDetails {
    // The original, detected dimensions of the image
    originalDimensions: ImageDimensions;
    originalDimensionsDetermined: boolean;
}

export interface ResizeDialogResult {
    targetSyntax: ImageSyntax;
    altText: string;
    title: string;
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
    originalDimensionsDetermined: boolean;
}

export interface EditorPosition {
    line: number;
    ch: number;
}

export interface EditorRange {
    from: EditorPosition;
    to: EditorPosition;
}

export interface EditorImageAtCursorResult extends ImageDetails {
    range: EditorRange;
}
