/**
 * Command registration for Simple Image Resize plugin.
 *
 * Registers all resize commands:
 * - resizeImage: Opens dialog for custom resize
 * - resize100/75/50/33/25: Stable quick resize slots
 *
 * All commands share common logic for image detection, dimension fetching,
 * and editor replacement.
 */

import joplin from 'api';
import { buildNewSyntax } from './imageSyntaxBuilder';
import type { ResizeDialog } from './dialog/resizeDialogHost';
import { getOriginalImageDimensions } from './originalImageDimensions';
import { detectImageAtCursor, replaceRangeInEditor, selectViewerImageInEditor } from './editorBridge';
import { isViewerImageTarget } from './viewerImageTarget';
import type { ImageContext } from './types';
import { logger } from './logger';
import { settingsCache } from './settings';
import { showToast, ToastType } from './utils/toastUtils';
import {
    buildQuickResizeResult,
    getQuickResizeSkippedMessage,
    getQuickResizeSuccessMessage,
    parseQuickResizeOptions,
    QUICK_RESIZE_SLOTS,
    requiresOriginalDimensions,
} from './quickResizeOptions';

/**
 * Shared function to handle image detection and dimension fetching
 */
async function detectAndPrepareImage(viewerTarget?: unknown) {
    if (viewerTarget !== undefined) {
        if (!isViewerImageTarget(viewerTarget) || !(await selectViewerImageInEditor(viewerTarget))) {
            await showToast('The viewer image is no longer available. Right-click it again.', ToastType.Info);
            return null;
        }
    }

    const cursorDetection = await detectImageAtCursor();

    if (!cursorDetection) {
        await showToast('No valid image found. Place cursor inside an image embed.');
        return null;
    }

    const partialContext = cursorDetection.context;
    const replacementRange = cursorDetection.range;

    // Get original dimensions
    logger.debug(`Processing ${partialContext.sourceType}: ${partialContext.source}`);

    const { dimensions: originalDimensions, determined: originalDimensionsDetermined } =
        await getOriginalImageDimensions(partialContext.source, partialContext.sourceType);

    const fullContext: ImageContext = { ...partialContext, originalDimensions, originalDimensionsDetermined };
    return { fullContext, replacementRange };
}

/**
 * Run a command body, reporting any unexpected failure to the user as a toast.
 */
async function withErrorToast(action: () => Promise<void>): Promise<void> {
    try {
        await action();
    } catch (err) {
        logger.error('Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        await showToast(`Operation failed: ${message}`, ToastType.Error);
    }
}

/**
 * Execute quick resize for a configured slot.
 */
async function executeQuickResizeSlot(slotIndex: number, viewerTarget?: unknown): Promise<void> {
    await withErrorToast(async () => {
        // The cached setting is always normalized, so parsing is not expected to fail;
        // withErrorToast handles the theoretical failure.
        const quickResizeOptions = parseQuickResizeOptions(settingsCache.quickResizeOptions);

        const option = quickResizeOptions[slotIndex];
        if (!option) {
            await showToast(`No quick resize option is configured for slot ${slotIndex + 1}.`, ToastType.Info);
            return;
        }

        const prepared = await detectAndPrepareImage(viewerTarget);
        if (!prepared) return;

        const { fullContext, replacementRange } = prepared;

        if (requiresOriginalDimensions(option) && !fullContext.originalDimensionsDetermined) {
            await showToast(getQuickResizeSkippedMessage(option), ToastType.Info);
            return;
        }

        const resizeResult = buildQuickResizeResult(option, fullContext.altText);
        const newSyntax = buildNewSyntax(fullContext, resizeResult, settingsCache.htmlSyntaxStyle);

        await replaceRangeInEditor(newSyntax, replacementRange, fullContext.syntax);

        await showToast(getQuickResizeSuccessMessage(option), ToastType.Success);
    });
}

/**
 * Register a quick resize command for a stable slot.
 */
async function registerQuickResizeCommand(slotIndex: number, commandName: string): Promise<void> {
    await joplin.commands.register({
        name: commandName,
        label: `Quick Resize ${slotIndex + 1}`,
        execute: async (viewerTarget?: unknown) => {
            await executeQuickResizeSlot(slotIndex, viewerTarget);
        },
    });
}

export async function registerCommands(resizeDialog: ResizeDialog): Promise<void> {
    // Enhanced resize command with intelligent detection
    await joplin.commands.register({
        name: 'resizeImage',
        label: 'Resize Image',
        iconName: 'fas fa-expand-alt',
        execute: async (viewerTarget?: unknown) => {
            await withErrorToast(async () => {
                const prepared = await detectAndPrepareImage(viewerTarget);
                if (!prepared) return;

                const { fullContext, replacementRange } = prepared;

                // Show dialog
                const result = await resizeDialog.open(fullContext, {
                    defaultResizeMode: settingsCache.defaultResizeMode,
                    defaultPercentage: settingsCache.defaultPercentage,
                });

                if (result) {
                    const newSyntax = buildNewSyntax(fullContext, result, settingsCache.htmlSyntaxStyle);
                    await replaceRangeInEditor(newSyntax, replacementRange, fullContext.syntax);

                    await showToast('Image resized successfully!', ToastType.Success);
                }
            });
        },
    });

    // Register stable quick resize slots. Slot targets come from settings at execution time.
    for (const [slotIndex, slot] of QUICK_RESIZE_SLOTS.entries()) {
        await registerQuickResizeCommand(slotIndex, slot.commandName);
    }
}
