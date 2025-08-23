import { ImageContext, ResizeDialogResult } from './types';

// Builds the new image syntax (markdown or HTML). This module no longer modifies the editor directly;
// it just returns the string to place on the clipboard.
export function buildNewSyntax(context: ImageContext, result: ResizeDialogResult): string {
    if (result.targetSyntax === 'markdown') {
        return `![${result.altText}](:/${context.resourceId})`;
    }

    let newWidth: number;
    let newHeight: number;

    if (result.resizeMode === 'percentage') {
        const percent = result.percentage || 100;
        newWidth = Math.round(context.originalDimensions.width * (percent / 100));
        newHeight = Math.round(context.originalDimensions.height * (percent / 100));
    } else {
        const origW = context.originalDimensions.width;
        const origH = context.originalDimensions.height;
        const providedW = result.absoluteWidth;
        const providedH = result.absoluteHeight;
        if (providedW && providedH) {
            newWidth = providedW;
            newHeight = providedH;
        } else if (providedW && !providedH) {
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

    return `<img src=":/${context.resourceId}" alt="${result.altText}" width="${newWidth}" height="${newHeight}" />`;
}
