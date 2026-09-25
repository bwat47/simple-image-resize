/**
 * Shared contract between the markdown viewer and the editor for viewer-origin
 * context menus.
 *
 * The viewer markdown-it plugin stamps each rendered image with the source line
 * range of the block it came from and its position among the images in that
 * range. When an image is right-clicked, the viewer script sends those values
 * to the plugin, which asks the editor to move the cursor onto the same image.
 *
 * Kept runtime dependency-free so the plugin, the CodeMirror content script,
 * and the markdown-it content script can all import it.
 *
 * `src/contentScripts/viewerContextMenu.js` runs as a plain script in the
 * viewer and cannot import this module, so it repeats the content script ID
 * and attribute names. Keep them in sync.
 */

export const VIEWER_CONTENT_SCRIPT_ID = 'simpleImageResize-viewerContentScript';

export const VIEWER_IMAGE_ATTRIBUTES = {
    line: 'data-image-resize-line',
    lineEnd: 'data-image-resize-line-end',
    index: 'data-image-resize-index',
} as const;

/**
 * A right-clicked viewer image, located in the note's Markdown source.
 *
 * - `line`, `lineEnd`: 0-based source line range (end exclusive) of the block
 *   the image was rendered from, as reported by markdown-it's token map.
 * - `index`: 0-based position among the images that start inside that range.
 * - `resourceId`: the resource the viewer rendered, used to confirm the editor
 *   resolved the same image.
 */
export interface ViewerImageTarget {
    line: number;
    lineEnd: number;
    index: number;
    resourceId: string;
}

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Validate a target received across the viewer/plugin/editor boundary.
 *
 * Takes `unknown` because the value arrives as plain data from a webview.
 */
export function isViewerImageTarget(value: unknown): value is ViewerImageTarget {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<ViewerImageTarget>;
    return (
        isNonNegativeInteger(candidate.line) &&
        isNonNegativeInteger(candidate.lineEnd) &&
        candidate.lineEnd > candidate.line &&
        isNonNegativeInteger(candidate.index) &&
        typeof candidate.resourceId === 'string' &&
        /^[a-f0-9]{32}$/i.test(candidate.resourceId)
    );
}
