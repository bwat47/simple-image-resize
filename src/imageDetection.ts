import { REGEX_PATTERNS } from './constants';
import { ImageContext } from './types';

export function detectImageSyntax(text: string): ImageContext | null {
    // Reset regex state due to global flag
    REGEX_PATTERNS.MARKDOWN_IMAGE_FULL.lastIndex = 0;
    REGEX_PATTERNS.HTML_IMAGE_FULL.lastIndex = 0;

    let match;

    // Check for markdown image: ![alt](:/resourceId)
    match = REGEX_PATTERNS.MARKDOWN_IMAGE_FULL.exec(text);
    if (match && match.groups) {
        return {
            type: 'markdown',
            syntax: match[0],
            resourceId: match.groups.resourceId,
            altText: match.groups.altText,
            range: { start: match.index, end: match.index + match[0].length },
        };
    }

    // Check for HTML image: <img src=":/resourceId" ... >
    match = REGEX_PATTERNS.HTML_IMAGE_FULL.exec(text);
    if (match && match.groups) {
        // Basic alt text extraction for now
        const altMatch = match[0].match(REGEX_PATTERNS.IMG_ALT);
        const altText = altMatch ? altMatch[1] : '';

        return {
            type: 'html',
            syntax: match[0],
            resourceId: match.groups.resourceId,
            altText: altText,
            range: { start: match.index, end: match.index + match[0].length },
        };
    }

    return null;
}
