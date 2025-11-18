import { ImageContext, ResizeDialogResult } from './types';
import { escapeHtmlAttribute, escapeMarkdownTitle } from './stringUtils';

/**
 * Generates new image syntax based on user selections.
 *
 * Handles conversion between Markdown and HTML formats, applies resizing (percentage or absolute),
 * and preserves aspect ratio when only one dimension is specified.
 *
 * @param context - Original image metadata and dimensions
 * @param result - User's selections from the resize dialog
 * @returns New image syntax
 */
export function buildNewSyntax(context: ImageContext, result: ResizeDialogResult): string {
    // Determine the correct source path format
    const srcPath = context.sourceType === 'resource' ? `:/${context.source}` : context.source;

    let newSyntax: string;

    if (result.targetSyntax === 'markdown') {
        const titlePart = context.title ? ` "${escapeMarkdownTitle(context.title)}"` : '';
        newSyntax = `![${result.altText}](${srcPath}${titlePart})`;
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
        const titleAttr = context.title ? ` title="${escapeHtmlAttribute(context.title)}"` : '';
        const safeAlt = escapeHtmlAttribute(result.altText);
        newSyntax = `<img src="${srcPath}" alt="${safeAlt}" width="${newWidth}"${titleAttr} />`;
    }

    return newSyntax;
}
