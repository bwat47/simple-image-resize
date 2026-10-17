/**
 * Shared contract between the plugin host and the CodeMirror content script.
 *
 * The content script registers these commands and the host invokes them through
 * `editor.execCommand`. Kept runtime dependency-free so both bundles can import it
 * without pulling in the other side's code.
 */

import type { EditorPosition } from './types';

export const EDITOR_CONTENT_SCRIPT_ID = 'simpleImageResize-cursorContentScript';

export const GET_IMAGE_AT_CURSOR_COMMAND = 'simpleImageResize-getImageAtCursor';
export const REPLACE_RANGE_COMMAND = 'simpleImageResize-replaceRange';
export const GET_IMAGE_DIMENSIONS_COMMAND = 'simpleImageResize-getImageDimensions';
export const IS_EDITOR_CONTEXT_MENU_ORIGIN_COMMAND = 'simpleImageResize-isEditorContextMenuOrigin';
export const MATCH_VIEWER_IMAGE_COMMAND = 'simpleImageResize-matchViewerImage';
export const SELECT_VIEWER_IMAGE_COMMAND = 'simpleImageResize-selectViewerImage';

/** Arguments of `REPLACE_RANGE_COMMAND`, passed positionally in this order. */
export interface ReplaceRangeArgs {
    text: string;
    from: EditorPosition;
    to: EditorPosition;
    expectedText: string;
}
