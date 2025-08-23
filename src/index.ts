import joplin from 'api';
import { ToastType } from 'api/types';
import { buildNewSyntax } from './editorModifier';
import { detectImageSyntax } from './imageDetection';
import { showResizeDialog } from './dialogHandler';

joplin.plugins.register({
    onStart: async function () {
        await joplin.commands.register({
            name: 'resizeImage',
            label: 'Resize Image',
            iconName: 'fas fa-expand-alt',
            execute: async () => {
                try {
                    // Use editor.execCommand to get the selected text
                    const selectedText = await joplin.commands.execute('editor.execCommand', {
                        name: 'getSelection',
                    });

                    if (!selectedText) {
                        await joplin.views.dialogs.showToast({
                            message: 'Please select an image syntax to resize.',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    const imageContext = detectImageSyntax(selectedText);

                    if (!imageContext) {
                        await joplin.views.dialogs.showToast({
                            message: 'No valid image syntax found in the selection.',
                            type: ToastType.Info,
                        });
                        return;
                    }

                    // Show the dialog to get user input
                    const result = await showResizeDialog(imageContext);

                    if (result) {
                        // Build the new image syntax based on user choices
                        const newSyntax = buildNewSyntax(imageContext, result);

                        // Replace the selected text with the new syntax
                        await joplin.commands.execute('editor.execCommand', {
                            name: 'replaceSelection',
                            value: newSyntax,
                        });

                        await joplin.views.dialogs.showToast({
                            message: 'Image syntax updated successfully!',
                            type: ToastType.Success,
                        });
                    }
                } catch (err) {
                    console.error('[Image Resize] Error:', err);
                    await joplin.views.dialogs.showToast({
                        message: 'Operation failed: ' + (err?.message || err),
                        type: ToastType.Error,
                    });
                }
            },
        });
    },
});
