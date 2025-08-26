// In constants.ts
export const REGEX_PATTERNS = {
    // ![alt text](:/32charresourceid)
    MARKDOWN_IMAGE_FULL: /!\[(?<altText>[^\]]*)\]\(:\/(?<resourceId>[a-f0-9]{32})\)/i, // single (non-global) for detection with groups

    // <img src=":/resourceid" ... >
    HTML_IMAGE_FULL: /<img\s+[^>]*src=["']:\/(?<resourceId>[a-f0-9]{32})["'][^>]*>/i, // single (non-global) for detection with groups

    // Extract existing width/height from HTML img
    IMG_WIDTH: /\bwidth\s*=\s*["']?(\d+)["']?/i,
    IMG_HEIGHT: /\bheight\s*=\s*["']?(\d+)["']?/i,
    IMG_ALT: /\balt\s*=\s*["']([^"']*)["']/i,

    // For validating a string that is ONLY a markdown image
    MARKDOWN_IMAGE_ONLY: /^!\[[^\]]*\]\(:\/[a-f0-9]{32}\)$/i,

    // For validating a string that is ONLY an HTML image
    HTML_IMAGE_ONLY: /^<img\s+[^>]*src=["']:\/[a-f0-9]{32}["'][^>]*>$/i,

    // Global variants for counting occurrences (case-insensitive)
    MARKDOWN_IMAGE_GLOBAL: /!\[[^\]]*\]\(:\/[a-f0-9]{32}\)/gi,
    HTML_IMAGE_GLOBAL: /<img\s+[^>]*src=["']:\/[a-f0-9]{32}["'][^>]*>/gi,
    ANY_IMAGE_GLOBAL: /(?:!\[[^\]]*\]\(:\/[a-f0-9]{32}\))|(?:<img\s+[^>]*src=["']:\/[a-f0-9]{32}["'][^>]*>)/gi,
};

export const SETTINGS = {
    DEFAULT_RESIZE_MODE: 'defaultResizeMode',
    DEFAULT_SYNTAX: 'defaultSyntax',
};

export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
};
