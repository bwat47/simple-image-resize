// In constants.ts
export const REGEX_PATTERNS = {
    // ![alt text](:/32charresourceid) OR ![alt text](https://...)
    MARKDOWN_IMAGE_FULL: /!\[(?<altText>[^\]]*)\]\((?::\/(?<resourceId>[a-f0-9]{32})|(?<url>https?:\/\/[^\)]+))\)/i, // single (non-global) for detection with groups

    // <img src=":/resourceid" ... > OR <img src="https://..." ... >
    HTML_IMAGE_FULL: /<img\s+[^>]*src=["'](?::\/(?<resourceId>[a-f0-9]{32})|(?<url>https?:\/\/[^"']+))["'][^>]*>/i, // single (non-global) for detection with groups

    // Extract existing width/height from HTML img
    IMG_WIDTH: /\bwidth\s*=\s*["']?(\d+)["']?/i,
    IMG_HEIGHT: /\bheight\s*=\s*["']?(\d+)["']?/i,
    IMG_ALT: /\balt\s*=\s*["']([^"']*)["']/i,

    // For validating a string that is ONLY a markdown image (resource or external)
    MARKDOWN_IMAGE_ONLY: /^!\[[^\]]*\]\((?::\/[a-f0-9]{32}|https?:\/\/[^\)]+)\)$/i,

    // For validating a string that is ONLY an HTML image (resource or external)
    HTML_IMAGE_ONLY: /^<img\s+[^>]*src=["'](?::\/[a-f0-9]{32}|https?:\/\/[^"']+)["'][^>]*>$/i,

    // Global variants for counting occurrences (case-insensitive) - support both formats
    MARKDOWN_IMAGE_GLOBAL: /!\[[^\]]*\]\((?::\/[a-f0-9]{32}|https?:\/\/[^\)]+)\)/gi,
    HTML_IMAGE_GLOBAL: /<img\s+[^>]*src=["'](?::\/[a-f0-9]{32}|https?:\/\/[^"']+)["'][^>]*>/gi,
    ANY_IMAGE_GLOBAL:
        /(?:!\[[^\]]*\]\((?::\/[a-f0-9]{32}|https?:\/\/[^\)]+)\))|(?:<img\s+[^>]*src=["'](?::\/[a-f0-9]{32}|https?:\/\/[^"']+)["'][^>]*>)/gi,
};

export const SETTINGS = {
    DEFAULT_RESIZE_MODE: 'defaultResizeMode',
    DEFAULT_SYNTAX: 'defaultSyntax',
};

export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
    EXTERNAL_IMAGE_TIMEOUT_MS: 10000, // Longer timeout for external images
    DEFAULT_EXTERNAL_WIDTH: 400, // Fallback dimensions when external image fails
    DEFAULT_EXTERNAL_HEIGHT: 300,
};
