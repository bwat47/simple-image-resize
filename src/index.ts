// src/index.ts - Enhanced version
import joplin from 'api';
import { ToastType, SettingItemType, MenuItemLocation } from 'api/types';
import { buildNewSyntax } from './imageSyntaxBuilder';
import { detectImageSyntax } from './imageDetection';
import { showResizeDialog } from './dialogHandler';
import { getOriginalImageDimensions } from './imageSizeCalculator';
import { hasMultipleImages, selectionHasOnlySingleImage, containsAnyImage } from './selectionValidation';
import { detectImageAtCursor, isOnImageInMarkdownEditor, EditorRange } from './cursorDetection';
import { ImageContext } from './types';
import { CONSTANTS } from './constants';

joplin.plugins.register({
    onStart: async function () {
        // Register plugin settings
        await joplin.settings.registerSection('imageResize', {
            label: 'Simple Image Resize',
            iconName: 'fas fa-expand-alt',
        });

        await joplin.settings.registerSettings({
            'imageResize.defaultResizeMode': {
                value: 'percentage',
                type: SettingItemType.String,
                section: 'imageResize',
                public: true,
                label: 'Default resize mode',
                description: 'The resize mode that will be selected by default when opening the resize dialog',
                isEnum: true,
                options: {
                    percentage: 'Percentage',
                    absolute: 'Absolute size',
                },
            },
        });

        // Enhanced resize command with intelligent detection
        await joplin.commands.register({
            name: 'resizeImage',
            label: 'Resize Image',
            iconName: 'fas fa-expand-alt',
            execute: async () => {
                try {
                    let partialContext: Omit<ImageContext, 'originalDimensions'> | null = null;
                    let replacementRange: EditorRange | null = null;
                    let useSelection = false;

                    // Strategy 1: Check if user has selected a single valid image
                    try {
                        const selectedText = (await joplin.commands.execute('editor.execCommand', {
                            name: 'getSelection',
                        })) as string;

                        if (selectedText && selectedText.trim()) {
                            if (hasMultipleImages(selectedText)) {
                                await joplin.views.dialogs.showToast({
                                    message:
                                        'Multiple images found in selection. Please select a single image or place cursor inside one.',
                                    type: ToastType.Info,
                                });
                                return;
                            }

                            if (selectionHasOnlySingleImage(selectedText)) {
                                partialContext = detectImageSyntax(selectedText);
                                if (partialContext) {
                                    useSelection = true;
                                }
                            } else if (containsAnyImage(selectedText)) {
                                await joplin.views.dialogs.showToast({
                                    message: 'Please select only the image syntax, or place cursor inside the image.',
                                    type: ToastType.Info,
                                });
                                return;
                            }
                        }
                    } catch {
                        // Selection failed, fall back to cursor detection
                    }

                    // Strategy 2: No valid selection, try cursor detection
                    if (!partialContext) {
                        const cursorDetection = await detectImageAtCursor();
                        if (cursorDetection) {
                            partialContext = cursorDetection.context;
                            replacementRange = cursorDetection.range;
                        }
                    }

                    // Strategy 3: No valid image found
                    if (!partialContext) {
                        await joplin.views.dialogs.showToast({
                            message: 'No valid image found. Place cursor inside an image or select an image syntax.',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    // Get original dimensions
                    console.log(`[Image Resize] Processing ${partialContext.sourceType}: ${partialContext.source}`);

                    let originalDimensions;
                    try {
                        originalDimensions = await getOriginalImageDimensions(
                            partialContext.source,
                            partialContext.sourceType
                        );
                    } catch (err) {
                        console.warn(`[Image Resize] Dimension fetch failed:`, err);

                        if (partialContext.sourceType === 'external') {
                            originalDimensions = {
                                width: CONSTANTS.DEFAULT_EXTERNAL_WIDTH,
                                height: CONSTANTS.DEFAULT_EXTERNAL_HEIGHT,
                            };
                            await joplin.views.dialogs.showToast({
                                message: `Using default dimensions for external image (${CONSTANTS.DEFAULT_EXTERNAL_WIDTH}×${CONSTANTS.DEFAULT_EXTERNAL_HEIGHT}).`,
                                type: ToastType.Info,
                            });
                        } else {
                            throw err;
                        }
                    }

                    // Show dialog
                    const defaultResizeMode = (await joplin.settings.value('imageResize.defaultResizeMode')) as
                        | 'percentage'
                        | 'absolute';
                    const fullContext: ImageContext = { ...partialContext, originalDimensions };
                    const result = await showResizeDialog(fullContext, defaultResizeMode);

                    if (result) {
                        const newSyntax = buildNewSyntax(fullContext, result);

                        // Automatic replacement instead of clipboard
                        if (useSelection) {
                            await joplin.commands.execute('editor.execCommand', {
                                name: 'replaceSelection',
                                args: [newSyntax],
                            });
                        } else if (replacementRange) {
                            await joplin.commands.execute('editor.execCommand', {
                                name: 'replaceRange',
                                args: [newSyntax, replacementRange.from, replacementRange.to],
                            });
                        }

                        await joplin.views.dialogs.showToast({
                            message: 'Image resized successfully!',
                            type: ToastType.Success,
                        });
                    }
                } catch (err) {
                    console.error('[Image Resize] Error:', err);
                    const message = err?.message || 'Unknown error occurred';
                    await joplin.views.dialogs.showToast({
                        message: `Operation failed: ${message}`,
                        type: ToastType.Error,
                    });
                }
            },
        });

        // Keep fallback menu item in Edit menu
        await joplin.views.menuItems.create('imageResizeMenuItem', 'resizeImage', MenuItemLocation.Edit);

        // Enhanced context menu with intelligent showing
        joplin.workspace.filterEditorContextMenu(async (contextMenu) => {
            // Only show resize option when cursor is on an image in markdown editor
            const shouldShowResize = await isOnImageInMarkdownEditor();

            if (shouldShowResize) {
                const hasResizeCommand = contextMenu.items.some((item) => item.commandName === 'resizeImage');

                if (!hasResizeCommand) {
                    contextMenu.items.push({
                        commandName: 'resizeImage',
                        label: 'Resize Image',
                    });
                    console.log('[Image Resize] Added context menu item - cursor on image');
                }
            }

            return contextMenu;
        });
    },
});
