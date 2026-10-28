import { decodeHTMLAttribute, decodeHTMLStrict, escapeUTF8 } from 'entities';

/**
 * Replaces each line break (CRLF, CR or LF) with one space; other whitespace is preserved.
 *
 * Generated syntax and the dialog's single-line inputs both keep alt text and titles on one line.
 */
export function normalizeLineBreaks(value: string): string {
    return value.replace(/\r\n|[\r\n]/g, ' ');
}

/**
 * Escapes a string for safe inclusion inside a double-quoted HTML attribute value.
 *
 * Escapes `&`, `<`, `>`, `"` and `'`; all other characters are left as-is.
 *
 * @param value - Raw string to escape
 * @returns HTML-escaped string safe for use in attribute values
 */
export function escapeHtmlAttribute(value: string): string {
    if (!value) return '';
    return escapeUTF8(value);
}

// The part of a CommonMark entity reference after the `&`, e.g. `copy;`, `#169;`, `#xA9;`.
// Numeric references have 7/6 digit limits. Shared by decoding and escaping so both
// agree on what Markdown treats as an entity.
const MARKDOWN_ENTITY_BODY = String.raw`(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]+);`;

// Matches an `&` that would start an entity reference Markdown decodes, for example:
// `&lt;`, `&#60;`, `&#x3C;` (but not the `&` in `Tom & Jerry` or `&amp Jerry`)
const MARKDOWN_ENTITY_AMPERSAND_PATTERN = new RegExp(`&(?=${MARKDOWN_ENTITY_BODY})`, 'g');

// ASCII punctuation; a backslash before one of these is a Markdown escape, e.g. `\[`, `\&`.
const ASCII_PUNCTUATION = String.raw`[!-/:-@[-\`{-~]`;

// Matches a backslash escape (e.g. `\&`, `\\`) or a CommonMark entity reference
// (e.g. `&copy;`, `&#169;`, `&#xA9;`).
const MARKDOWN_ESCAPE_OR_ENTITY_PATTERN = new RegExp(
    String.raw`\\(${ASCII_PUNCTUATION})|&${MARKDOWN_ENTITY_BODY}`,
    'g'
);

// Matches a backslash Markdown would treat as an escape: before punctuation or at the end
// of the value (where it would escape the closing `]` or `"`), e.g. `\[`, `path\`.
// Literal backslashes like `C:\notes` are not matched.
const ESCAPING_BACKSLASH = String.raw`\\(?=${ASCII_PUNCTUATION}|$)`;

// Matches what must be escaped in alt text: escaping backslashes, brackets, backticks,
// and `<` that could start raw HTML or an autolink (a code span, tag or autolink could
// otherwise hide the closing bracket), e.g. `[`, `]`, `` ` ``, `<span`, `</b`, `<!--`.
// A `<` that cannot start a tag, e.g. in `a < b`, is left as-is.
const MARKDOWN_ALT_SPECIAL_PATTERN = new RegExp(String.raw`${ESCAPING_BACKSLASH}|[[\]\`]|<(?=[a-zA-Z/!?])`, 'g');

// Matches what must be escaped in a double-quoted title: escaping backslashes and quotes.
const MARKDOWN_TITLE_SPECIAL_PATTERN = new RegExp(String.raw`${ESCAPING_BACKSLASH}|"`, 'g');

/**
 * Escapes ampersands that Markdown would otherwise interpret as entity references,
 * so literal text like `&lt;` survives a round trip. Other ampersands stay readable.
 */
function escapeMarkdownEntities(value: string): string {
    return value.replace(MARKDOWN_ENTITY_AMPERSAND_PATTERN, '&amp;');
}

/**
 * Escapes a Markdown title for use inside double quotes.
 *
 * Escapes quotes, entity-like sequences and backslashes that would act as escapes,
 * so extraction and Markdown rendering recover the original plain text.
 * Literal backslashes like `C:\notes` are left as-is.
 *
 * @param value - Plain title text
 * @returns Escaped title safe for use in Markdown `![alt](url "title")` syntax
 */
export function escapeMarkdownTitle(value: string): string {
    if (!value) return '';
    return escapeMarkdownEntities(value).replace(MARKDOWN_TITLE_SPECIAL_PATTERN, '\\$&');
}

/**
 * Decodes HTML entities in an attribute value.
 *
 * Single-pass decode of all HTML5 named entities and numeric character references,
 * using attribute-value parsing rules (e.g. `&amp;lt;` → `&lt;`, `&#128512;` → `😀`).
 *
 * @param value - HTML-encoded attribute value
 * @returns Decoded plain text
 */
export function decodeHtmlEntities(value: string): string {
    if (!value) return '';
    return decodeHTMLAttribute(value);
}

/**
 * Decodes backslash escapes and entities in Markdown alt text or titles.
 *
 * Follows CommonMark: only semicolon-terminated references are decoded
 * (e.g. `&amp;lt;` → `&lt;`, but `Tom &amp Jerry` is left as-is).
 * Both are processed in one pass: an escaped ampersand cannot start an entity,
 * and decoded characters are never interpreted again.
 *
 * @param value - Raw Markdown alt text or title
 * @returns Decoded plain text
 */
export function decodeMarkdownText(value: string): string {
    if (!value) return '';
    return value.replace(
        MARKDOWN_ESCAPE_OR_ENTITY_PATTERN,
        (reference, escaped: string | undefined) => escaped ?? decodeHTMLStrict(reference)
    );
}

/**
 * Escapes a plain Markdown alt text string.
 *
 * Escapes brackets, backticks, tag-like `<`, entity-like sequences and backslashes that would
 * act as escapes, so extraction recovers the original text without breaking Markdown syntax.
 * Other inline markup (e.g. `_` in `my_image.png`) is left as-is to keep notes readable.
 *
 * @param value - Plain alt text
 * @returns Escaped alt text safe for use in Markdown `![alt](url)` syntax
 */
export function escapeMarkdownAlt(value: string): string {
    if (!value) return '';
    return escapeMarkdownEntities(value).replace(MARKDOWN_ALT_SPECIAL_PATTERN, '\\$&');
}
