/**
 * Escapes a string for safe inclusion inside a double-quoted HTML attribute value.
 *
 * @param value - Raw string to escape
 * @returns HTML-escaped string safe for use in attribute values
 */
export function escapeHtmlAttribute(value: string): string {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Escapes a Markdown title for use inside double quotes.
 *
 * Escapes characters that would terminate the title string or cause parsing issues.
 *
 * @param value - Raw title text
 * @returns Escaped title safe for use in Markdown `![alt](url "title")` syntax
 */
export function escapeMarkdownTitle(value: string): string {
    if (!value) return '';
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Decodes HTML entities commonly found in attributes.
 *
 * Supports named entities (`&quot;`, `&amp;`, etc.) and numeric character references.
 *
 * @param value - HTML-encoded string
 * @returns Decoded plain text
 */
export function decodeHtmlEntities(value: string): string {
    if (!value) return '';
    let str = String(value);
    // Decode amp first in case the input contains &amp;quot; etc
    str = str.replace(/&amp;/g, '&');
    // Numeric character references (decimal and hex)
    str = str.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    str = str.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    // Named entities we care about
    str = str
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    return str;
}

/**
 * Sanitizes a Markdown alt text string.
 *
 * Removes brackets to prevent breaking Markdown syntax.
 *
 * @param value - Raw alt text
 * @returns Sanitized alt text safe for use in Markdown `![alt](url)` syntax
 */
export function sanitizeMarkdownAlt(value: string): string {
    return String(value || '').replace(/[\[\]]/g, '');
}
