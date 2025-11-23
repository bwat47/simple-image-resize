import { REGEX_PATTERNS } from './constants';
import { decodeHtmlEntities } from './utils/stringUtils';
import { ImageContext } from './types';

/**
 * Parses image syntax (Markdown or HTML) from text and extracts metadata.
 *
 * Supports both Markdown format `![alt](url "title")` and HTML `<img>` tags.
 * Returns partial context without dimensions (added later by caller).
 *
 * @param text - Text containing an image embed
 * @returns Parsed image metadata, or null if no valid image syntax found
 */
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
        };
    }

    // Check for HTML image: <img src=":/resourceId" ... > or <img src="https://..." ... >
    match = text.match(REGEX_PATTERNS.HTML_IMAGE_FULL);
    if (match && match.groups) {
        const resourceId = match.groups.resourceId;
        const url = match.groups.url;

        // Basic alt text extraction for now
        const altMatch = match[0].match(REGEX_PATTERNS.IMG_ALT);
        const altText = altMatch ? decodeHtmlEntities(altMatch[2]) : '';
        const titleMatch = match[0].match(REGEX_PATTERNS.IMG_TITLE);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[2]) : '';

        return {
            type: 'html',
            syntax: match[0],
            source: resourceId || url,
            sourceType: resourceId ? 'resource' : 'external',
            altText: altText,
            title: title,
        };
    }

    return null;
}
