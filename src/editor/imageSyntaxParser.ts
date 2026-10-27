import type { ImageDetails } from '../shared/types';
import { decodeHtmlEntities, decodeMarkdownText } from '../shared/stringUtils';

/**
 * Raw source text of a Markdown image's parts, sliced from its syntax tree node.
 *
 * For `![a [b]](<:/0123456789abcdef0123456789abcdef> "t")`:
 * `{ altText: 'a [b]', url: '<:/0123456789abcdef0123456789abcdef>', title: '"t"' }`
 */
export interface MarkdownImageParts {
    /** Text between `![` and the closing `]`, still escaped. */
    altText: string;
    /** Destination, including any angle brackets. */
    url: string;
    /** Title including its delimiters, or `''` when absent. */
    title: string;
}

// Matches an angle-bracketed destination, e.g. <:/0123456789abcdef0123456789abcdef>
const ANGLE_BRACKET_URL_PATTERN = /^<([\s\S]*)>$/;

// Matches what may not be safe in a bare destination, e.g. the space in <my image.png>
// or the unbalanced parenthesis in <a(b.png>. Angle-bracketed destinations containing
// these are rejected because Markdown output writes the source bare.
const NEEDS_ANGLE_BRACKETS_PATTERN = /[\s()]/;

// Matches a Joplin resource source, for example: :/0123456789abcdef0123456789abcdef
const RESOURCE_ID_PATTERN = /:\/([a-f0-9]{32})/;

// Matches an external HTTP(S) source, for example: https://example.com/image.png
const EXTERNAL_URL_PATTERN = /(https?:\/\/[^\s"']+)/;

// Attribute patterns preserve matching quote pairs, for example: src="image.png".
// Alt and title values may span lines, e.g. alt="first\nsecond".
const HTML_SRC_PATTERN = /src=(["'])([^"']+)\1/i;
const HTML_ALT_PATTERN = /alt=(["'])([\s\S]*?)\1/i;
const HTML_TITLE_PATTERN = /title=(["'])([\s\S]*?)\1/i;

type ImageSourceInfo = Pick<ImageDetails, 'source' | 'sourceType'>;

function resolveImageSource(src: string): ImageSourceInfo {
    const resourceMatch = RESOURCE_ID_PATTERN.exec(src);
    if (resourceMatch) return { source: resourceMatch[1], sourceType: 'resource' };

    const urlMatch = EXTERNAL_URL_PATTERN.exec(src);
    if (urlMatch) return { source: urlMatch[1], sourceType: 'external' };

    return { source: src, sourceType: 'external' };
}

/**
 * Extract image metadata from the parts of a syntax-tree-validated Markdown image.
 *
 * The syntax tree has already matched brackets, delimiters and code spans, so this
 * only strips delimiters and decodes escapes and entities.
 */
export function extractMarkdownDetails(imageText: string, parts: MarkdownImageParts): ImageDetails | null {
    const angleMatch = ANGLE_BRACKET_URL_PATTERN.exec(parts.url);
    const src = angleMatch ? angleMatch[1] : parts.url;
    if (!src || (angleMatch && NEEDS_ANGLE_BRACKETS_PATTERN.test(src))) return null;

    return {
        type: 'markdown',
        syntax: imageText,
        ...resolveImageSource(src),
        altText: decodeMarkdownText(parts.altText),
        // Titles are delimited by one character on each side: "t", 't' or (t).
        title: decodeMarkdownText(parts.title.slice(1, -1)),
    };
}

/**
 * Extract image metadata from an HTML `<img>` tag found by the syntax tree.
 */
export function extractHtmlDetails(imageText: string): ImageDetails | null {
    const srcMatch = HTML_SRC_PATTERN.exec(imageText);
    if (!srcMatch) return null;

    const src = srcMatch[2];
    const altMatch = HTML_ALT_PATTERN.exec(imageText);
    const titleMatch = HTML_TITLE_PATTERN.exec(imageText);

    return {
        type: 'html',
        syntax: imageText,
        ...resolveImageSource(src),
        altText: altMatch ? decodeHtmlEntities(altMatch[2]) : '',
        title: titleMatch ? decodeHtmlEntities(titleMatch[2]) : '',
    };
}
