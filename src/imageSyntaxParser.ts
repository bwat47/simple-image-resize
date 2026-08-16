import type { EditorImageAtCursorResult } from './types';
import { decodeHtmlEntities } from './utils/stringUtils';

// Matches a syntax-tree-validated Markdown image, for example:
// ![Alt text](:/0123456789abcdef0123456789abcdef "Optional title")
const MARKDOWN_IMAGE_PATTERN = /!\[(?<altText>[^\]]*)\]\(\s*(?<src>[^)\s]+)(?:\s+["'](?<title>[^"']+)["'])?\s*\)/;

// Matches a Joplin resource source, for example: :/0123456789abcdef0123456789abcdef
const RESOURCE_ID_PATTERN = /:\/([a-f0-9]{32})/;

// Matches an external HTTP(S) source, for example: https://example.com/image.png
const EXTERNAL_URL_PATTERN = /(https?:\/\/[^\s"']+)/;

// Attribute patterns preserve matching quote pairs, for example: src="image.png".
const HTML_SRC_PATTERN = /src=(["'])([^"']+)\1/i;
const HTML_ALT_PATTERN = /alt=(["'])(.*?)\1/i;
const HTML_TITLE_PATTERN = /title=(["'])(.*?)\1/i;

type ImageSyntaxType = EditorImageAtCursorResult['type'];
type ExtractedImageDetails = Omit<EditorImageAtCursorResult, 'range'>;
type ImageSourceInfo = Pick<EditorImageAtCursorResult, 'source' | 'sourceType'>;

function resolveImageSource(src: string): ImageSourceInfo {
    const resourceMatch = src.match(RESOURCE_ID_PATTERN);
    if (resourceMatch) return { source: resourceMatch[1], sourceType: 'resource' };

    const urlMatch = src.match(EXTERNAL_URL_PATTERN);
    if (urlMatch) return { source: urlMatch[1], sourceType: 'external' };

    return { source: src, sourceType: 'external' };
}

function extractMarkdownDetails(imageText: string): ExtractedImageDetails | null {
    const match = imageText.match(MARKDOWN_IMAGE_PATTERN);
    if (!match?.groups) return null;

    const { altText, src, title } = match.groups;

    return {
        type: 'markdown',
        syntax: imageText,
        ...resolveImageSource(src),
        altText: altText || '',
        title: title || '',
    };
}

function extractHtmlDetails(imageText: string): ExtractedImageDetails | null {
    const srcMatch = imageText.match(HTML_SRC_PATTERN);
    if (!srcMatch) return null;

    const src = srcMatch[2];
    const altMatch = imageText.match(HTML_ALT_PATTERN);
    const titleMatch = imageText.match(HTML_TITLE_PATTERN);

    return {
        type: 'html',
        syntax: imageText,
        ...resolveImageSource(src),
        altText: altMatch ? decodeHtmlEntities(altMatch[2]) : '',
        title: titleMatch ? decodeHtmlEntities(titleMatch[2]) : '',
    };
}

/**
 * Extract image metadata after CodeMirror's syntax tree has identified the syntax type.
 */
export function extractImageDetails(imageText: string, syntaxType: ImageSyntaxType): ExtractedImageDetails | null {
    return syntaxType === 'markdown' ? extractMarkdownDetails(imageText) : extractHtmlDetails(imageText);
}
