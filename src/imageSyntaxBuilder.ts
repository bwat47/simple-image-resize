import { ImageContext, ResizeDialogResult } from './types';

// This module no longer modifies the editor directly; it just returns the string to place on the clipboard.

// Extracts trailing whitespace (including newlines) from a string.
function getTrailingWhitespace(text: string): string {
    const match = text.match(/(\s*)$/);
    return match ? match[1] : '';
}

// Builds the new image syntax and preserves trailing whitespace from the original selection.
export function buildNewSyntax(context: ImageContext, result: ResizeDialogResult): string {
    const trailingWhitespace = getTrailingWhitespace(context.originalSelection);

    // Determine the correct source path format
    const srcPath = context.sourceType === 'resource' ? `:/${context.source}` : context.source;

    let newSyntax: string;

    if (result.targetSyntax === 'markdown') {
        newSyntax = `![${result.altText}](${srcPath})`;
    } else {
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
        newSyntax = `<img src="${srcPath}" alt="${result.altText}" width="${newWidth}" height="${newHeight}" />`;
    }

    // Append the original trailing whitespace to the new syntax
    return newSyntax + trailingWhitespace;
}
