/**
 * Which resize dialog controls are enabled for a given syntax and resize mode.
 *
 * Shared by the plugin host (initial markup) and the dialog webview (live updates),
 * so both apply the same rules. Must stay free of runtime imports that are not
 * browser-compatible.
 */

import type { ImageSyntax, ResizeMode } from '../types';

export interface DialogFieldState {
    /** The mode actually in effect: percentage falls back to absolute without original dimensions. */
    resizeMode: ResizeMode;
    /** The resizing fieldset is locked because Markdown syntax cannot carry a size. */
    resizeLocked: boolean;
    percentageModeDisabled: boolean;
    percentageDisabled: boolean;
    absoluteDisabled: boolean;
    heightDisabled: boolean;
    /** The height row needs its own disabled styling, i.e. it is disabled inside an enabled absolute group. */
    heightDimmed: boolean;
}

export function getDialogFieldState(
    syntax: ImageSyntax,
    requestedMode: ResizeMode,
    originalDimensionsDetermined: boolean
): DialogFieldState {
    // Percentage resizing has nothing to scale from when the original size is unknown.
    const resizeMode: ResizeMode =
        requestedMode === 'percentage' && !originalDimensionsDetermined ? 'absolute' : requestedMode;
    const htmlActive = syntax === 'html';
    const isPercentage = resizeMode === 'percentage';

    const absoluteDisabled = !htmlActive || isPercentage;
    const heightDisabled = absoluteDisabled || !originalDimensionsDetermined;

    return {
        resizeMode,
        resizeLocked: !htmlActive,
        percentageModeDisabled: !originalDimensionsDetermined,
        percentageDisabled: !htmlActive || !isPercentage,
        absoluteDisabled,
        heightDisabled,
        heightDimmed: heightDisabled && !absoluteDisabled,
    };
}
