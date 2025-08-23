import joplin from 'api';
import { MenuItemLocation, ToastType } from 'api/types';
import { buildNewSyntax } from './editorModifier';
import { detectImageSyntax } from './imageDetection';
import { showResizeDialog } from './dialogHandler';
import { getOriginalImageDimensions } from './imageSizeCalculator';

joplin.plugins.register({
  onStart: async function () {
    // Register the command
    await joplin.commands.register({
      name: 'resizeImage',
      label: 'Resize Image',
      iconName: 'fas fa-expand-alt',
      execute: async () => {
        try {
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

          const partialContext = detectImageSyntax(selectedText);

          if (!partialContext) {
            await joplin.views.dialogs.showToast({
              message: 'No valid image syntax found in the selection.',
              type: ToastType.Info,
            });
            return;
          }

          const originalDimensions = await getOriginalImageDimensions(
            partialContext.resourceId
          );

          const result = await showResizeDialog({
            ...partialContext,
            originalDimensions,
          });

          if (result) {
            const newSyntax = buildNewSyntax(
              { ...partialContext, originalDimensions },
              result
            );

            // The safest approach is to copy the new syntax to the clipboard.
            // This avoids race conditions with editor selection and gives the user full control.
            await joplin.clipboard.writeText(newSyntax);

            await joplin.views.dialogs.showToast({
              message: 'Resized image syntax copied to clipboard!',
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

    // Add a context menu item to trigger the command
    await joplin.views.menuItems.create(
      'imageResizeContextMenuItem',
      'resizeImage',
      MenuItemLocation.EditorContextMenu
    );
  },
});
