import joplin from 'api';
import { MenuItemLocation, ToastType, SettingItemType } from 'api/types';
import { buildNewSyntax } from './imageSyntaxBuilder';
import { detectImageSyntax } from './imageDetection';
import { showResizeDialog } from './dialogHandler';
import { getOriginalImageDimensions } from './imageSizeCalculator';

// Helper function to check for multiple images
function hasMultipleImages(text: string): boolean {
    const markdownMatches = text.match(/!\[[^\]]*\]\(:\/{1,2}[a-f0-9]{32}\)/g) || [];
    const htmlMatches = text.match(/<img\s+[^>]*src=["']:\/[a-f0-9]{32}["'][^>]*>/g) || [];
    return markdownMatches.length + htmlMatches.length > 1;
}

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

        // Register the command
        await joplin.commands.register({
            name: 'resizeImage',
            label: 'Resize Image',
            iconName: 'fas fa-expand-alt',
            when: 'markdownEditorVisible',
            execute: async () => {
                try {
                    // Safely attempt to get selection (only valid in Markdown editor)
                    let selectedText: string | null = null;
                    try {
                        selectedText = await joplin.commands.execute('editor.execCommand', { name: 'getSelection' });
                    } catch {
                        // Swallow; will handle below
                    }

                    if (typeof selectedText !== 'string') {
                        await joplin.views.dialogs.showToast({
                            message:
                                'Image Resize: This command only works in the Markdown editor. Switch to Markdown (code) editor and select an image syntax.',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    if (!selectedText.trim()) {
                        await joplin.views.dialogs.showToast({
                            message: 'Please select an image syntax to resize.',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    // Check for multiple images for better UX
                    if (hasMultipleImages(selectedText)) {
                        await joplin.views.dialogs.showToast({
                            message: 'Multiple images found in selection. Please select a single image.',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    const partialContext = detectImageSyntax(selectedText);

                    if (!partialContext) {
                        await joplin.views.dialogs.showToast({
                            message: 'No valid image syntax found. Please select ![...](:/...) or <img src=":/..." />',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    // Show brief loading feedback for dimension calculation
                    console.log(`[Image Resize] Loading dimensions for resource: ${partialContext.resourceId}`);

                    const originalDimensions = await getOriginalImageDimensions(partialContext.resourceId);

                    // Get user's default resize mode preference
                    const defaultResizeMode = (await joplin.settings.value('imageResize.defaultResizeMode')) as
                        | 'percentage'
                        | 'absolute';

                    const result = await showResizeDialog(
                        {
                            ...partialContext,
                            originalDimensions,
                        },
                        defaultResizeMode
                    );

                    if (result) {
                        const newSyntax = buildNewSyntax({ ...partialContext, originalDimensions }, result);
                        await joplin.clipboard.writeText(newSyntax);

                        await joplin.views.dialogs.showToast({
                            message: 'Resized image syntax copied to clipboard! Paste to replace the original.',
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

        // Add a context menu item to trigger the command
        await joplin.views.menuItems.create(
            'imageResizeContextMenuItem',
            'resizeImage',
            MenuItemLocation.EditorContextMenu
        );
    },
});
