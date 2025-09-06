// String escaping helpers for HTML and Markdown

// Escapes a string for safe inclusion inside a double-quoted HTML attribute value
export function escapeHtmlAttribute(value: string): string {
    if (value == null) return '';
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Escapes a Markdown title that will be emitted inside double quotes: "title"
// Strategy: HTML-escape &, ", <, > so that literal quotes don't terminate the title.
export function escapeMarkdownTitle(value: string): string {
    if (!value) return '';
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Decodes a subset of HTML entities commonly used in attributes, including numeric refs
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
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
    return str;
}
