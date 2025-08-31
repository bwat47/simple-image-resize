import { REGEX_PATTERNS } from './constants';

/** Returns true if the text contains more than one image syntax (markdown and/or HTML). */
export function hasMultipleImages(text: string): boolean {
    const markdownMatches = text.match(REGEX_PATTERNS.MARKDOWN_IMAGE_GLOBAL) || [];
    const htmlMatches = text.match(REGEX_PATTERNS.HTML_IMAGE_GLOBAL) || [];
    return markdownMatches.length + htmlMatches.length > 1;
}

/** Returns true if, after trimming leading/trailing whitespace, the text is exactly one image syntax. */
export function selectionHasOnlySingleImage(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    return REGEX_PATTERNS.MARKDOWN_IMAGE_ONLY.test(trimmed) || REGEX_PATTERNS.HTML_IMAGE_ONLY.test(trimmed);
}

/** Returns true if text contains at least one image (markdown or HTML). */
export function containsAnyImage(text: string): boolean {
    return REGEX_PATTERNS.MARKDOWN_IMAGE_FULL.test(text) || REGEX_PATTERNS.HTML_IMAGE_FULL.test(text);
}
