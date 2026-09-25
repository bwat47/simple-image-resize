/**
 * Markdown-it content script for the markdown viewer.
 *
 * Stamps every rendered image with its location in the note's Markdown source
 * (see `ViewerImageTarget`) and loads `viewerContextMenu.js`, which reports the
 * right-clicked image to the plugin. The editor then resolves that location
 * with its own syntax tree and moves the cursor onto the image.
 *
 * Location model: markdown-it only maps block tokens to source lines, so each
 * image is identified by the line range of the block it was rendered from plus
 * its position among the images in that range. The editor counts images the
 * same way, so both sides must agree on what counts as an image:
 * - Markdown `image` tokens (the editor's `Image` nodes)
 * - `<img ...>` tags in inline or block HTML (the editor's `HTMLTag` and
 *   `HTMLBlock` detection), matched with the same regex the editor uses
 */

import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token';
import { VIEWER_IMAGE_ATTRIBUTES } from '../viewerImageTarget';

type LineMap = [number, number];

export interface ImageSourcePosition {
    line: number;
    lineEnd: number;
    index: number;
}

/** Key under `token.meta` that carries a Markdown image's source position to the renderer. */
const POSITION_META_KEY = 'simpleImageResizePosition';

/**
 * Matches an HTML `<img>` tag, e.g. `<img src=":/abc" width="200">`.
 * Same pattern as the editor's HTMLBlock scan, so both count the same tags.
 */
const IMG_TAG_REGEX = /<img\s[^>]*>/gi;

function positionAttributes(position: ImageSourcePosition): string {
    return (
        ` ${VIEWER_IMAGE_ATTRIBUTES.line}="${position.line}"` +
        ` ${VIEWER_IMAGE_ATTRIBUTES.lineEnd}="${position.lineEnd}"` +
        ` ${VIEWER_IMAGE_ATTRIBUTES.index}="${position.index}"`
    );
}

/** Insert position attributes right after the first `<img` in rendered HTML. */
function addAttributesToImgTag(html: string, position: ImageSourcePosition): string {
    return html.replace(/<img\b/i, `<img${positionAttributes(position)}`);
}

/**
 * Record the source position of every image in a parsed token stream.
 *
 * Markdown images get the position in `token.meta`, because Joplin renders
 * resource images from scratch and would drop extra token attributes. HTML
 * `<img>` tags get the attributes written into the token content; Joplin's
 * HTML image rule keeps unknown attributes when it rewrites resource sources.
 *
 * Tokens without their own map (table cells) use the nearest enclosing block
 * map (the table row), so images in the same row share one range and are
 * numbered left to right, matching the editor's per-line scan.
 */
export function annotateImagePositions(tokens: Token[]): void {
    const nextIndexByRange = new Map<string, number>();
    const enclosingMaps: (LineMap | null)[] = [];

    const claimPosition = (map: LineMap): ImageSourcePosition => {
        const key = `${map[0]}:${map[1]}`;
        const index = nextIndexByRange.get(key) ?? 0;
        nextIndexByRange.set(key, index + 1);
        return { line: map[0], lineEnd: map[1], index };
    };

    const annotateHtml = (html: string, map: LineMap): string =>
        html.replace(IMG_TAG_REGEX, (tag) => addAttributesToImgTag(tag, claimPosition(map)));

    for (const token of tokens) {
        if (token.nesting === -1) {
            enclosingMaps.pop();
            continue;
        }

        const map = (token.map as LineMap | null) ?? enclosingMaps[enclosingMaps.length - 1] ?? null;

        if (token.nesting === 1) {
            enclosingMaps.push(map);
            continue;
        }

        if (!map) {
            continue;
        }

        if (token.type === 'html_block') {
            token.content = annotateHtml(token.content, map);
        } else if (token.type === 'inline') {
            annotateInlineChildren(token.children ?? [], map);
        }
    }

    function annotateInlineChildren(children: Token[], map: LineMap): void {
        for (const child of children) {
            if (child.type === 'image') {
                child.meta = { ...child.meta, [POSITION_META_KEY]: claimPosition(map) };
            } else if (child.type === 'html_inline') {
                child.content = annotateHtml(child.content, map);
            }
        }
    }
}

/**
 * Install the position annotations on a markdown-it instance.
 *
 * Only active when the renderer maps output to source lines (`mapsToLine`),
 * which Joplin enables for the note viewer, so exports and other renders stay
 * unchanged.
 */
export function installImagePositions(markdownIt: MarkdownIt, options?: { mapsToLine?: boolean }): void {
    if (!options?.mapsToLine) {
        return;
    }

    // Pushed after Joplin's own core rules, so HTML has already been sanitized.
    markdownIt.core.ruler.push('simpleImageResize_imagePositions', (state) => {
        annotateImagePositions(state.tokens);
    });

    const defaultImageRender = markdownIt.renderer.rules.image;
    markdownIt.renderer.rules.image = (tokens, idx, options, env, self) => {
        const html = defaultImageRender
            ? defaultImageRender(tokens, idx, options, env, self)
            : self.renderToken(tokens, idx, options);
        const position = tokens[idx].meta?.[POSITION_META_KEY] as ImageSourcePosition | undefined;
        return position ? addAttributesToImgTag(html, position) : html;
    };
}

export default function (): {
    plugin: (markdownIt: MarkdownIt, options?: { mapsToLine?: boolean }) => void;
    assets: () => { name: string }[];
} {
    return {
        plugin: installImagePositions,
        assets: () => [{ name: 'viewerContextMenu.js' }],
    };
}
