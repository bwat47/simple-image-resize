import { ImageContext, ResizeDialogResult } from './types';

export function buildNewSyntax(context: ImageContext, result: ResizeDialogResult): string {
    // If the target is Markdown, we can't apply dimensions, so just return the basic syntax.
    if (result.targetSyntax === 'markdown') {
        return `![${result.altText}](:/${context.resourceId})`;
    }

    // If the target is HTML, calculate the new dimensions.
    let newWidth: number;
    let newHeight: number;

    if (result.resizeMode === 'percentage') {
        const percent = result.percentage || 100;
        newWidth = Math.round(context.originalDimensions.width * (percent / 100));
        newHeight = Math.round(context.originalDimensions.height * (percent / 100));
    } else {
        // absolute
        const origW = context.originalDimensions.width;
        const origH = context.originalDimensions.height;
        const providedW = result.absoluteWidth;
        const providedH = result.absoluteHeight;
        if (providedW && providedH) {
            newWidth = providedW;
            newHeight = providedH;
        } else if (providedW && !providedH) {
            // Derive height from width to keep aspect ratio
            newWidth = providedW;
            newHeight = Math.round(providedW * (origH / origW));
        } else if (!providedW && providedH) {
            newHeight = providedH;
            newWidth = Math.round(providedH * (origW / origH));
        } else {
            newWidth = origW;
            newHeight = origH;
        }
    }

    // Build the final HTML <img> tag.
    return `<img src=":/${context.resourceId}" alt="${result.altText}" width="${newWidth}" height="${newHeight}" />`;
}
