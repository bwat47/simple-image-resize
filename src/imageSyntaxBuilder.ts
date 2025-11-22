import joplin from 'api';
import { ImageContext, ResizeDialogResult } from './types';
import { escapeHtmlAttribute, escapeMarkdownTitle, sanitizeMarkdownAlt } from './stringUtils';
import { SETTING_HTML_SYNTAX_STYLE } from './settings';

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
export async function buildNewSyntax(context: ImageContext, result: ResizeDialogResult): Promise<string> {
    // Determine the correct source path format
    const srcPath = context.sourceType === 'resource' ? `:/${context.source}` : context.source;

    let newSyntax: string;

    if (result.targetSyntax === 'markdown') {
        const titlePart = context.title ? ` "${escapeMarkdownTitle(context.title)}"` : '';
        newSyntax = `![${sanitizeMarkdownAlt(result.altText)}](${srcPath}${titlePart})`;
    } else {
        const origW = context.originalDimensions.width;
        const origH = context.originalDimensions.height;
        let newWidth: number;

        if (result.resizeMode === 'percentage') {
            const percent = result.percentage || 100;
            newWidth = Math.round(origW * (percent / 100));
        } else {
            const providedW = result.absoluteWidth;
            const providedH = result.absoluteHeight;
            if (providedW && providedH) {
                newWidth = providedW;
            } else if (providedW && !providedH) {
                newWidth = providedW;
            } else if (!providedW && providedH) {
                newWidth = Math.round(providedH * (origW / origH));
            } else {
                newWidth = origW;
            }
        }

        // Calculate height to preserve aspect ratio
        // Guard against division by zero (edge case with malformed image dimensions)
        const newHeight = origW > 0 ? Math.round(newWidth * (origH / origW)) : origH;

        // Check setting for whether to include height attribute
        const htmlSyntaxStyle = await joplin.settings.value(SETTING_HTML_SYNTAX_STYLE);
        const includeHeight = htmlSyntaxStyle === 'widthAndHeight';

        const titleAttr = context.title ? ` title="${escapeHtmlAttribute(context.title)}"` : '';
        const safeAlt = escapeHtmlAttribute(result.altText);
        const heightAttr = includeHeight ? ` height="${newHeight}"` : '';
        newSyntax = `<img src="${srcPath}" alt="${safeAlt}" width="${newWidth}"${heightAttr}${titleAttr} />`;
    }

    return newSyntax;
}
