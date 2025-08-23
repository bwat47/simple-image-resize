import joplin from 'api';
import { ImageContext, ResizeDialogResult } from './types';

let dialogHandle: string = null;

export async function showResizeDialog(context: ImageContext): Promise<ResizeDialogResult | null> {
    if (dialogHandle) {
        joplin.views.dialogs.close(dialogHandle);
    }

    dialogHandle = await joplin.views.dialogs.create('imageResizeDialog');
    await joplin.views.dialogs.setHtml(dialogHandle, `
        <h4>Image Syntax Switcher</h4>
        <form name="resizeForm">
            <p>Current syntax: <strong>${context.type}</strong></p>
            <p>Switch to:</p>
            <input type="radio" id="markdown" name="targetSyntax" value="markdown" ${context.type === 'markdown' ? 'checked' : ''}>
            <label for="markdown">Markdown</label><br>
            <input type="radio" id="html" name="targetSyntax" value="html" ${context.type === 'html' ? 'checked' : ''}>
            <label for="html">HTML</label>
            <hr>
            <label for="altText">Alt Text:</label>
            <input type="text" id="altText" name="altText" value="${context.altText}">
        </form>
    `);

    const result = await joplin.views.dialogs.open(dialogHandle);

    if (result.id === 'ok' && result.formData) {
        return {
            targetSyntax: result.formData.resizeForm.targetSyntax,
            altText: result.formData.resizeForm.altText,
        };
    }

    return null;
}
