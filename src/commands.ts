/**
 * Command registration for Simple Image Resize plugin.
 *
 * Registers all resize commands:
 * - resizeImage: Opens dialog for custom resize
 * - resize100/75/50/25: Quick resize to specific percentages
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
import { copyImageToClipboard } from './utils/clipboardUtils';

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
    logger.info(`Processing ${partialContext.sourceType}: ${partialContext.source}`);

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
 * Execute quick resize for a given percentage
 */
async function executeQuickResize(percentage: number): Promise<void> {
    try {
        const prepared = await detectAndPrepareImage();
        if (!prepared) return;

        const { fullContext, replacementRange } = prepared;

        // 100% converts to Markdown (removes custom sizing), others use HTML
        const targetSyntax = percentage === 100 ? 'markdown' : 'html';

        const newSyntax = await buildNewSyntax(fullContext, {
            targetSyntax,
            altText: fullContext.altText,
            resizeMode: 'percentage',
            percentage,
        });

        await replaceImageInEditor(newSyntax, replacementRange, fullContext.syntax);

        // Different message for 100% (conversion) vs others (resize)
        const message =
            percentage === 100
                ? 'Custom size removed - converted to Markdown syntax.'
                : `Image resized to ${percentage}%.`;

        await showToast(message, ToastType.Success);
    } catch (err) {
        logger.error('Error:', err);
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        await showToast(`Operation failed: ${message}`, ToastType.Error);
    }
}

/**
 * Register a quick resize command for a specific percentage
 */
async function registerQuickResizeCommand(percentage: number): Promise<void> {
    await joplin.commands.register({
        name: `resize${percentage}`,
        label: `Resize ${percentage}%`,
        execute: async () => {
            await executeQuickResize(percentage);
        },
    });
}

/**
 * Copy image at cursor to clipboard
 */
async function executeCopyImageToClipboard(): Promise<void> {
    const cursorDetection = await detectImageAtCursor();

    if (!cursorDetection) {
        await showToast('No valid image found. Place cursor inside an image embed.');
        return;
    }

    const { source, sourceType } = cursorDetection.context;
    await copyImageToClipboard(source, sourceType);
}

export async function registerCommands(): Promise<void> {
    // Copy image to clipboard command
    await joplin.commands.register({
        name: 'copyImageToClipboard',
        label: 'Copy Image',
        iconName: 'fas fa-copy',
        execute: async () => {
            await executeCopyImageToClipboard();
        },
    });

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

    // Register quick resize commands (100%, 75%, 50%, 25%)
    await registerQuickResizeCommand(100);
    await registerQuickResizeCommand(75);
    await registerQuickResizeCommand(50);
    await registerQuickResizeCommand(25);
}
