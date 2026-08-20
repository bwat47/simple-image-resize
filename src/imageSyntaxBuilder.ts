import { ImageContext, ResizeDialogResult } from './types';
import { escapeHtmlAttribute, escapeMarkdownTitle, sanitizeMarkdownAlt } from './utils/stringUtils';
import { settingsCache } from './settings';

function buildSourcePath(context: ImageContext): string {
    return context.sourceType === 'resource' ? `:/${context.source}` : context.source;
}

function buildMarkdownSyntax(context: ImageContext, result: ResizeDialogResult, srcPath: string): string {
    const titlePart = context.title ? ` "${escapeMarkdownTitle(context.title)}"` : '';
    return `![${sanitizeMarkdownAlt(result.altText)}](${srcPath}${titlePart})`;
}

function calculateWidth(context: ImageContext, result: ResizeDialogResult): number {
    const { width: originalWidth, height: originalHeight } = context.originalDimensions;

    if (result.resizeMode === 'percentage') {
        const percent = result.percentage || 100;
        return Math.round(originalWidth * (percent / 100));
    }

    if (result.absoluteWidth) {
        return result.absoluteWidth;
    }

    if (result.absoluteHeight) {
        return Math.round(result.absoluteHeight * (originalWidth / originalHeight));
    }

    return originalWidth;
}

function buildHtmlSyntax(context: ImageContext, result: ResizeDialogResult, srcPath: string): string {
    const { width: originalWidth, height: originalHeight } = context.originalDimensions;
    const newWidth = calculateWidth(context, result);

    // Guard against division by zero (edge case with malformed image dimensions)
    const newHeight = originalWidth > 0 ? Math.round(newWidth * (originalHeight / originalWidth)) : originalHeight;
    const includeHeight = settingsCache.htmlSyntaxStyle === 'widthAndHeight' && context.originalDimensionsDetermined;
    const heightAttr = includeHeight ? ` height="${newHeight}"` : '';
    const titleAttr = context.title ? ` title="${escapeHtmlAttribute(context.title)}"` : '';
    const safeAlt = escapeHtmlAttribute(result.altText);

    return `<img src="${srcPath}" alt="${safeAlt}" width="${newWidth}"${heightAttr}${titleAttr} />`;
}

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
    const srcPath = buildSourcePath(context);

    if (result.targetSyntax === 'markdown') {
        return buildMarkdownSyntax(context, result, srcPath);
    }

    return buildHtmlSyntax(context, result, srcPath);
}
