// In types.ts
export interface ImageContext {
    type: 'markdown' | 'html';
    syntax: string;
    resourceId: string;
    altText: string;
    range: { start: number; end: number };
    // Additional properties for HTML context
    width?: number;
    height?: number;
}

export interface ResizeDialogResult {
    targetSyntax: 'markdown' | 'html';
    altText: string;
    // More properties will be added in Phase 2
}
