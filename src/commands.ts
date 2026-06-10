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
import { showResizeDialog } from './dialogHandler';
import { getOriginalImageDimensions } from './imageSizeCalculator';
import { detectImageAtCursor } from './cursorDetection';
import { ImageContext, EditorRange } from './types';
import { CONSTANTS } from './constants';
import { logger } from './logger';
import { resizeDialogLock } from './dialogLock';
import { settingsCache } from './settings';
import { REPLACE_RANGE_COMMAND } from './contentScripts/cursorContentScript';
import { showToast, ToastType } from './utils/toastUtils';
import {
    buildQuickResizeResult,
    getQuickResizeSuccessMessage,
    parseQuickResizeOptions,
    QUICK_RESIZE_SLOTS,
} from './quickResizeOptions';

/**
 * Shared function to handle image detection and dimension fetching
 */
async function detectAndPrepareImage() {
    const cursorDetection = await detectImageAtCursor();

    if (!cursorDetection) {
        await showToast('No valid image found. Place cursor inside an image embed.');
        return null;
    }

    const partialContext = cursorDetection.context;
    const replacementRange = cursorDetection.range;

    // Get original dimensions
    logger.debug(`Processing ${partialContext.sourceType}: ${partialContext.source}`);

    let originalDimensions;
    try {
        originalDimensions = await getOriginalImageDimensions(partialContext.source, partialContext.sourceType);
    } catch (error) {
        logger.warn('Dimension fetch failed:', error);

        if (partialContext.sourceType === 'external') {
            originalDimensions = {
                width: CONSTANTS.DEFAULT_EXTERNAL_WIDTH,
                height: CONSTANTS.DEFAULT_EXTERNAL_HEIGHT,
            };
            await showToast(
                `Using default dimensions for external image (${CONSTANTS.DEFAULT_EXTERNAL_WIDTH}×${CONSTANTS.DEFAULT_EXTERNAL_HEIGHT}).`
            );
        } else {
            throw error;
        }
    }

    const fullContext: ImageContext = { ...partialContext, originalDimensions };
    return { fullContext, replacementRange };
}

/**
 * Shared function to replace image in editor.
 * Uses custom content script command for cross-platform support (desktop + mobile).
 */
async function replaceImageInEditor(newSyntax: string, replacementRange: EditorRange, originalSyntax: string) {
    await joplin.commands.execute('editor.execCommand', {
        name: REPLACE_RANGE_COMMAND,
        args: [newSyntax, replacementRange.from, replacementRange.to, originalSyntax],
    });
}

/**
 * Execute quick resize for a configured slot.
 */
async function executeQuickResizeSlot(slotIndex: number): Promise<void> {
    try {
        let quickResizeOptions;
        try {
            quickResizeOptions = parseQuickResizeOptions(settingsCache.quickResizeOptions);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown validation error';
            await showToast(`Invalid quick resize options setting: ${message}`, ToastType.Error);
            return;
        }

        const option = quickResizeOptions[slotIndex];
        if (!option) {
            await showToast(`No quick resize option is configured for slot ${slotIndex + 1}.`, ToastType.Info);
            return;
        }

        const prepared = await detectAndPrepareImage();
        if (!prepared) return;

        const { fullContext, replacementRange } = prepared;

        const resizeResult = buildQuickResizeResult(option, fullContext.altText);
        const newSyntax = await buildNewSyntax(fullContext, resizeResult);

        await replaceImageInEditor(newSyntax, replacementRange, fullContext.syntax);

        await showToast(getQuickResizeSuccessMessage(option), ToastType.Success);
    } catch (err) {
        logger.error('Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        await showToast(`Operation failed: ${message}`, ToastType.Error);
    }
}

/**
 * Register a quick resize command for a stable slot.
 */
async function registerQuickResizeCommand(slotIndex: number, commandName: string): Promise<void> {
    await joplin.commands.register({
        name: commandName,
        label: `Quick Resize ${slotIndex + 1}`,
        execute: async () => {
            await executeQuickResizeSlot(slotIndex);
        },
    });
}

export async function registerCommands(): Promise<void> {
    // Enhanced resize command with intelligent detection
    await joplin.commands.register({
        name: 'resizeImage',
        label: 'Resize Image',
        iconName: 'fas fa-expand-alt',
        execute: async () => {
            let dialogLockAcquired = false;

            try {
                const prepared = await detectAndPrepareImage();
                if (!prepared) return;

                const { fullContext, replacementRange } = prepared;

                // Show dialog
                const defaultResizeMode = settingsCache.defaultResizeMode;

                if (!resizeDialogLock.tryAcquire()) {
                    await showToast('Resize dialog is already open.');
                    logger.info('Resize dialog invocation skipped because another instance is open.');
                    return;
                }

                dialogLockAcquired = true;

                const result = await showResizeDialog(fullContext, defaultResizeMode);

                if (result) {
                    const newSyntax = await buildNewSyntax(fullContext, result);
                    await replaceImageInEditor(newSyntax, replacementRange, fullContext.syntax);

                    await showToast('Image resized successfully!', ToastType.Success);
                }
            } catch (err) {
                logger.error('Error:', err);
                const message = err instanceof Error ? err.message : 'Unknown error occurred';
                await showToast(`Operation failed: ${message}`, ToastType.Error);
            } finally {
                if (dialogLockAcquired) {
                    resizeDialogLock.release();
                }
            }
        },
    });

    // Register stable quick resize slots. Slot targets come from settings at execution time.
    for (const [slotIndex, slot] of QUICK_RESIZE_SLOTS.entries()) {
        await registerQuickResizeCommand(slotIndex, slot.commandName);
    }
}
