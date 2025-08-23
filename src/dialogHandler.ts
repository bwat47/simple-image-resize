import joplin from 'api';
import { ImageContext, ResizeDialogResult } from './types';

// We only need to create the dialog once and can then reuse the handle.
let dialogHandle: string = null;

export async function showResizeDialog(context: ImageContext): Promise<ResizeDialogResult | null> {
    // Create the dialog if it doesn't exist yet
    if (!dialogHandle) {
        dialogHandle = await joplin.views.dialogs.create('imageResizeDialog');
        // Keep dialog sized to its (now wider) content; default is true but we call explicitly for clarity.
        await joplin.views.dialogs.setFitToContent(dialogHandle, true);
    }

    const originalWidth = context.originalDimensions.width;
    const originalHeight = context.originalDimensions.height;

    // Always update the HTML and scripts before opening
    await joplin.views.dialogs.setHtml(
        dialogHandle,
        `
    <script type="text/javascript">
      const originalWidth = ${originalWidth};
      const originalHeight = ${originalHeight};
    </script>
    <style>
  :root { --gap: 10px; }
      *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.35; margin: 0; padding: 0; min-width: 540px; color: inherit; }
  .container { box-sizing: border-box; padding: 22px 26px 30px; display:flex; flex-direction:column; gap:20px; width:100%; }
      h4 { margin: 0 0 12px 0; font-size: 16px; }
  form { display: flex; flex-direction: column; gap: 22px; width:100%; }
  fieldset { border: 1px solid var(--joplin-divider-color, #ccc); border-radius: 6px; padding: 18px 20px 22px; margin: 0; min-width:0; }
      legend { font-weight: 600; padding: 0 6px; }
      .section-help { margin: 0 0 6px; opacity: .8; font-size: 12px; }
  .form-grid { display: grid; grid-template-columns: max-content 1fr; gap: 8px 12px; align-items: center; width: 100%; }
      .stack { display: flex; flex-direction: column; gap: 6px; }
      label { user-select: none; }
      .inline { display: inline-flex; align-items: center; gap: 6px; }
      .radio-row { display: flex; align-items: center; gap: 6px; }
      .input-row { display: flex; align-items: center; gap: 6px; }
  input[type="number"] { width: 88px; padding: 4px 6px; }
  input[type="text"] { padding: 6px 8px; flex: 1 1 auto; min-width: 0; max-width: 100%; }
      input[disabled] { opacity: .65; }
      #preview { font-weight: 600; font-variant-numeric: tabular-nums; }
      .syntax-options { display: flex; flex-direction: column; gap: 4px; }
      .divider { height:1px; background: var(--joplin-divider-color, #d0d0d0); margin: 4px 0 12px; }
  @media (min-width: 900px) { body { min-width: 600px; } }
  /* Output specific tweaks */
  .output-grid { display:grid; grid-template-columns: 80px 1fr; gap: 12px 16px; align-items:center; width:100%; }
  .output-grid label { white-space:nowrap; }
  .syntax-options { display:flex; flex-direction:column; gap:6px; }
  fieldset { width:100%; box-sizing:border-box; }
  body { overflow:auto; }
    </style>
      <div class="container">
    <h4>Resize Image</h4>
    <p style="margin:0 0 4px;">Original: <strong>${originalWidth}px × ${originalHeight}px</strong></p>
    <form name="resizeForm" autocomplete="off">
      <fieldset>
        <legend>Resizing</legend>
        <div class="form-grid">
          <div class="radio-row"><input type="radio" id="modePercent" name="resizeMode" value="percentage" checked><label for="modePercent">By percentage</label></div>
          <div class="input-row"><input type="number" name="percentage" id="percentage" value="50" min="1" max="500"><span>%</span></div>

          <div class="radio-row"><input type="radio" id="modeAbsolute" name="resizeMode" value="absolute"><label for="modeAbsolute">By absolute size</label></div>
          <div class="stack">
            <div class="input-row"><label for="absoluteWidth" style="width:55px;">Width</label><input type="number" name="absoluteWidth" id="absoluteWidth" placeholder="Width" disabled><span>px</span></div>
            <div class="input-row"><label for="absoluteHeight" style="width:55px;">Height</label><input type="number" name="absoluteHeight" id="absoluteHeight" placeholder="Height" disabled><span>px</span></div>
            <div class="input-row"><input type="checkbox" id="maintainAspectRatio" name="maintainAspectRatio" checked><label for="maintainAspectRatio">Maintain aspect ratio</label></div>
          </div>

          <label>Preview</label>
          <span id="preview"></span>
        </div>
      </fieldset>

      <fieldset class="output-section">
        <legend>Output</legend>
        <div class="output-grid">
          <label for="altText">Alt text</label>
          <input type="text" id="altText" name="altText" value="${context.altText}" placeholder="Describe the image">
          <label>Syntax</label>
          <div class="syntax-options">
            <label class="radio-row"><input type="radio" id="syntaxHtml" name="targetSyntax" value="html" checked> <span>HTML (&lt;img&gt;)</span></label>
            <label class="radio-row"><input type="radio" id="syntaxMarkdown" name="targetSyntax" value="markdown"> <span>Markdown</span></label>
          </div>
        </div>
      </fieldset>
    </form>
    </div>
    `
    );

    await joplin.views.dialogs.addScript(dialogHandle, './webview.js');

    const result = await joplin.views.dialogs.open(dialogHandle);

    if (result.id === 'ok' && result.formData) {
        const form = result.formData.resizeForm;
        return {
            targetSyntax: form.targetSyntax,
            altText: form.altText,
            resizeMode: form.resizeMode,
            percentage: form.percentage ? parseInt(form.percentage, 10) : undefined,
            absoluteWidth: form.absoluteWidth ? parseInt(form.absoluteWidth, 10) : undefined,
            absoluteHeight: form.absoluteHeight ? parseInt(form.absoluteHeight, 10) : undefined,
        };
    }

    return null;
}
