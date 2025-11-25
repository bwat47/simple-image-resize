import { REGEX_PATTERNS } from '../../src/constants';
import { decodeHtmlEntities } from '../../src/utils/stringUtils';
import { ImageContext } from '../../src/types';

/**
 * Test utility for validating image extraction regex patterns.
 *
 * This module tests the same REGEX_PATTERNS used by the content script's
 * extraction functions in production. Testing here validates the regex logic
 * without the complexity of mocking CodeMirror's environment.
 *
 * Why this exists:
 * - The content script uses REGEX_PATTERNS from constants.ts for extraction
 * - Testing the content script directly would require complex CodeMirror mocks
 * - This provides a simple test harness for the regex patterns
 * - Validates extraction logic: alt text, src, title, resource vs external URLs
 *
 * Note: In production, image DETECTION uses the syntax tree (in content script),
 * but EXTRACTION uses these same regex patterns tested here.
 *
 * @param text - Text containing an image embed
 * @returns Parsed image metadata, or null if no valid image syntax found
 */
export function extractImageDetails(text: string): Omit<ImageContext, 'originalDimensions'> | null {
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
