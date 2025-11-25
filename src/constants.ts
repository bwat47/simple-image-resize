export const REGEX_PATTERNS = {
    // Simplified extraction patterns (used with syntax tree detection)
    // These patterns assume the text is already validated as a valid image by the syntax tree

    // Extract parts from Markdown image: ![alt](src "title")
    MARKDOWN_EXTRACT: /!\[(?<altText>[^\]]*)\]\(\s*(?<src>[^)\s]+)(?:\s+["'](?<title>[^"']+)["'])?\s*\)/,

    // Extract resource ID from source (:/32charhexid)
    RESOURCE_ID: /:\/([a-f0-9]{32})/,

    // Extract external URL from source
    EXTERNAL_URL: /(https?:\/\/[^\s"']+)/,

    // Extract HTML img attributes (using backreferences to match quote pairs)
    HTML_SRC: /src=(["'])([^"']+)\1/i,
    HTML_ALT: /alt=(["'])(.*?)\1/i,
    HTML_TITLE: /title=(["'])(.*?)\1/i,
};

export const CONSTANTS = {
    BASE64_TIMEOUT_MS: 5000,
    EXTERNAL_IMAGE_TIMEOUT_MS: 10000, // Longer timeout for external images
    DEFAULT_EXTERNAL_WIDTH: 400, // Fallback dimensions when external image fails
    DEFAULT_EXTERNAL_HEIGHT: 300,
};
