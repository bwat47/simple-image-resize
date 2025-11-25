import { REGEX_PATTERNS } from './constants';
import { decodeHtmlEntities } from './utils/stringUtils';
import { ImageContext } from './types';

/**
 * Parses image syntax (Markdown or HTML) from text and extracts metadata.
 *
 * This function uses simplified extraction patterns and is primarily used for testing.
 * In production, image detection is handled by the content script using syntax tree analysis.
 *
 * Supports both Markdown format `![alt](url "title")` and HTML `<img>` tags.
 * Returns partial context without dimensions (added later by caller).
 *
 * @param text - Text containing an image embed
 * @returns Parsed image metadata, or null if no valid image syntax found
 */
export function detectImageSyntax(text: string): Omit<ImageContext, 'originalDimensions'> | null {
    // Try Markdown extraction first
    const markdownMatch = text.match(REGEX_PATTERNS.MARKDOWN_EXTRACT);
    if (markdownMatch?.groups) {
        const { altText, src, title } = markdownMatch.groups;

        // Determine if resource or external URL
        const resourceMatch = src.match(REGEX_PATTERNS.RESOURCE_ID);
        const urlMatch = src.match(REGEX_PATTERNS.EXTERNAL_URL);

        return {
            type: 'markdown',
            syntax: markdownMatch[0],
            source: resourceMatch ? resourceMatch[1] : urlMatch ? urlMatch[1] : src,
            sourceType: resourceMatch ? 'resource' : 'external',
            altText: altText || '',
            title: title || '',
        };
    }

    // Try HTML extraction
    const srcMatch = text.match(REGEX_PATTERNS.HTML_SRC);
    if (srcMatch) {
        const src = srcMatch[2]; // Group 2 contains the actual value (group 1 is the quote)
        const altMatch = text.match(REGEX_PATTERNS.HTML_ALT);
        const titleMatch = text.match(REGEX_PATTERNS.HTML_TITLE);

        // Determine if resource or external URL
        const resourceMatch = src.match(REGEX_PATTERNS.RESOURCE_ID);
        const urlMatch = src.match(REGEX_PATTERNS.EXTERNAL_URL);

        return {
            type: 'html',
            syntax: text,
            source: resourceMatch ? resourceMatch[1] : urlMatch ? urlMatch[1] : src,
            sourceType: resourceMatch ? 'resource' : 'external',
            altText: altMatch ? decodeHtmlEntities(altMatch[2]) : '', // Group 2 contains the value
            title: titleMatch ? decodeHtmlEntities(titleMatch[2]) : '', // Group 2 contains the value
        };
    }

    return null;
}
