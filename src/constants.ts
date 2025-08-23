// In constants.ts
export const REGEX_PATTERNS = {
    // ![alt text](:/32charresourceid)
    MARKDOWN_IMAGE_FULL: /!\[(?<altText>[^\]]*)\]\(:\/(?<resourceId>[a-f0-9]{32})\)/gi,

    // <img src=":/resourceid" ... >
    HTML_IMAGE_FULL: /<img\s+[^>]*src=["']:\/(?<resourceId>[a-f0-9]{32})["'][^>]*>/gi,

    // Extract existing width/height from HTML img
    IMG_WIDTH: /\bwidth\s*=\s*["']?(\d+)["']?/i,
    IMG_HEIGHT: /\bheight\s*=\s*["']?(\d+)["']?/i,
    IMG_ALT: /\balt\s*=\s*["']([^"']*)["']/i,
};

export const SETTINGS = {
    DEFAULT_RESIZE_MODE: 'defaultResizeMode',
    DEFAULT_SYNTAX: 'defaultSyntax',
};

export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
};
