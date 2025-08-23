import { REGEX_PATTERNS } from './constants';
import { ImageContext } from './types';

// This function returns a partial context, without the dimensions.
// The dimensions are added later in the main command logic.
export function detectImageSyntax(text: string): Omit<ImageContext, 'originalDimensions'> | null {
    let match;

    // Check for markdown image: ![alt](:/resourceId)
    match = text.match(REGEX_PATTERNS.MARKDOWN_IMAGE_FULL);
    if (match && match.groups) {
        return {
            type: 'markdown',
            syntax: match[0],
            resourceId: match.groups.resourceId,
            altText: match.groups.altText,
        };
    }

    // Check for HTML image: <img src=":/resourceId" ... >
    match = text.match(REGEX_PATTERNS.HTML_IMAGE_FULL);
    if (match && match.groups) {
        // Basic alt text extraction for now
        const altMatch = match[0].match(REGEX_PATTERNS.IMG_ALT);
        const altText = altMatch ? altMatch[1] : '';

        return {
            type: 'html',
            syntax: match[0],
            resourceId: match.groups.resourceId,
            altText: altText,
        };
    }

    return null;
}
