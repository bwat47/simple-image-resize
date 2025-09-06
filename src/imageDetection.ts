import { REGEX_PATTERNS } from './constants';
import { decodeHtmlEntities } from './stringUtils';
import { ImageContext } from './types';

// This function returns a partial context, without the dimensions.
// The dimensions are added later in the main command logic.
// It now includes the original user selection to preserve whitespace.
export function detectImageSyntax(text: string): Omit<ImageContext, 'originalDimensions'> | null {
    let match;

    // Check for markdown image: ![alt](:/resourceId) or ![alt](https://...)
    match = text.match(REGEX_PATTERNS.MARKDOWN_IMAGE_FULL);
    if (match && match.groups) {
        const groups = match.groups as {
            resourceId?: string;
            url?: string;
            altText: string;
            titleDouble?: string;
            titleSingle?: string;
        };
        const resourceId = groups.resourceId;
        const url = groups.url;
        const title = groups.titleDouble ?? groups.titleSingle ?? '';

        return {
            type: 'markdown',
            syntax: match[0],
            source: resourceId || url,
            sourceType: resourceId ? 'resource' : 'external',
            altText: groups.altText,
            title: title,
            originalSelection: text, // Capture the original selection
        };
    }

    // Check for HTML image: <img src=":/resourceId" ... > or <img src="https://..." ... >
    match = text.match(REGEX_PATTERNS.HTML_IMAGE_FULL);
    if (match && match.groups) {
        const resourceId = match.groups.resourceId;
        const url = match.groups.url;

        // Basic alt text extraction for now
        const altMatch = match[0].match(REGEX_PATTERNS.IMG_ALT);
        const altText = altMatch ? decodeHtmlEntities(altMatch[1]) : '';
        const titleMatch = match[0].match(REGEX_PATTERNS.IMG_TITLE);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';

        return {
            type: 'html',
            syntax: match[0],
            source: resourceId || url,
            sourceType: resourceId ? 'resource' : 'external',
            altText: altText,
            title: title,
            originalSelection: text, // Capture the original selection
        };
    }

    return null;
}
