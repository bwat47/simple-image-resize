import joplin from 'api';
import { ImageContext, ResizeDialogResult } from './types';
import { escapeHtmlAttribute } from './stringUtils';

export async function showResizeDialog(
    context: ImageContext,
    defaultResizeMode: 'percentage' | 'absolute' = 'percentage'
): Promise<ResizeDialogResult | null> {
    // We create a new dialog instance for each call to ensure a clean and predictable state.
    const dialogHandle = await joplin.views.dialogs.create(`imageResizeDialog_${Date.now()}`);
    await joplin.views.dialogs.setFitToContent(dialogHandle, true);
    await joplin.views.dialogs.addScript(dialogHandle, './dialog/resizeDialog.js');

    const originalWidth = context.originalDimensions.width;
    const originalHeight = context.originalDimensions.height;
    const defaultSyntax: 'html' | 'markdown' = 'html';
    const htmlSyntaxSelected = defaultSyntax === 'html';
    const percentageModeDefault = defaultResizeMode === 'percentage';
    const percentageInitiallyDisabled = !htmlSyntaxSelected || !percentageModeDefault;
    const absoluteInitiallyDisabled = !htmlSyntaxSelected || percentageModeDefault;

    const resizeFieldsetClass = `resize-fieldset${htmlSyntaxSelected ? '' : ' is-locked'}`;
    const percentageRowClass = `row${percentageInitiallyDisabled ? ' is-disabled' : ''}`;
    const absoluteGroupClass = `stack absolute-size-group${absoluteInitiallyDisabled ? ' is-disabled' : ''}`;

    const htmlCheckedAttr = htmlSyntaxSelected ? ' checked' : '';
    const markdownCheckedAttr = htmlSyntaxSelected ? '' : ' checked';
    const percentageModeCheckedAttr = percentageModeDefault ? ' checked' : '';
    const absoluteModeCheckedAttr = percentageModeDefault ? '' : ' checked';

    const percentageDisabledAttr = percentageInitiallyDisabled ? ' disabled' : '';
    const absoluteDisabledAttr = absoluteInitiallyDisabled ? ' disabled' : '';

    // Always update the HTML and scripts before opening
    await joplin.views.dialogs.setHtml(
        dialogHandle,
        `
    <style>
      *, *::before, *::after { box-sizing: border-box }
      body { 
        font-family: system-ui, sans-serif; 
        font-size: 14px; 
        margin: 0; 
        padding: 0; 
        min-width: 620px;
      }
      .container { 
        padding: 22px 26px 30px; 
        display: flex; 
        flex-direction: column; 
        gap: 18px; 
        width: 100%;
      }
      h4 { margin: 0 0 10px; font-size: 16px }
      form { display: flex; flex-direction: column; gap: 22px; width: 100%; }
      fieldset { 
        border: 1px solid var(--joplin-divider-color, #ccc); 
        border-radius: 6px; 
        padding: 18px 20px 20px; 
        margin: 0; 
        min-width: 0; 
        width: 100%;
        transition: opacity 0.2s ease, background-color 0.2s ease;
      }
      legend { font-weight: 600 }
      .grid { 
        display: grid; 
        grid-template-columns: 140px 1fr; 
        gap: 10px 18px; 
        align-items: center; 
        width: 100%;
      }
      .grid.narrow { grid-template-columns: max-content 1fr; }
      .stack { display: flex; flex-direction: column; gap: 6px }
      .row { display: flex; align-items: center; gap: 6px; min-width: 0; }
      label { user-select: none; cursor: pointer; }
      input[type=number] { 
        width: 92px; 
        padding: 4px 6px;
        transition: background-color 0.2s ease, opacity 0.2s ease;
      }
      input[type=text] { 
        width: 100%; 
        padding: 6px 8px; 
        min-width: 0;
        transition: background-color 0.2s ease;
      }
      input[type=radio] { cursor: pointer; }
      .hint { 
        font-size: 11px; 
        opacity: 0.7; 
        margin-top: 4px;
        transition: opacity 0.2s ease;
      }
      .row.is-disabled,
      .stack.is-disabled { opacity: 0.6 }
      .row.is-disabled input,
      .stack.is-disabled input {
        background-color: #f0f0f0;
        cursor: not-allowed;
      }
      .stack.is-disabled .hint { opacity: 0.4 }
      .resize-fieldset.is-locked {
        opacity: 0.4;
        pointer-events: none;
        background-color: #fafafa;
      }
      .resize-fieldset.is-locked input {
        cursor: not-allowed;
      }
      
      /* Code examples styling */
      code {
        background-color: #f5f5f5;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 10px;
      }
      
      /* Responsive improvements */
      @media (max-width: 700px) {
        body { min-width: 480px; }
        .grid { grid-template-columns: 120px 1fr; gap: 8px 12px; }
        .container { padding: 16px 20px 24px; gap: 14px; }
        code { font-size: 9px; }
      }
      
      @media (min-width: 860px) {
        body { min-width: 680px }
        .grid { grid-template-columns: 160px 1fr }
      }
    </style>
    <div id="dialog-root"
         data-default-resize-mode="${escapeHtmlAttribute(defaultResizeMode)}"
         data-initial-syntax="${escapeHtmlAttribute(defaultSyntax)}"
         data-original-width="${escapeHtmlAttribute(String(originalWidth))}"
         data-original-height="${escapeHtmlAttribute(String(originalHeight))}">
      <div class="container">
        <div>
          <h4>Resize Image</h4>
          <p style="margin:0 0 4px;">Original: <strong>${originalWidth}px × ${originalHeight}px</strong></p>
        </div>
        <form name="resizeForm" autocomplete="off">
          <fieldset>
            <legend>Output</legend>
            <div class="grid narrow">
              <label for="altText" style="white-space:nowrap;">Alt text</label>
              <div class="row" style="padding:0;min-width:0;">
                <input type="text" id="altText" name="altText" value="${escapeHtmlAttribute(context.altText)}" placeholder="Describe the image">
              </div>
              <label style="white-space:nowrap;">Syntax</label>
              <div class="stack">
                <label class="row">
                  <input type="radio" name="targetSyntax" value="html"${htmlCheckedAttr}>
                  <span style="display:flex;flex-direction:column;gap:2px;">
                    <span>HTML (supports resizing)</span>
                    <code style="font-size:11px;opacity:0.7;">&lt;img src=":/resourceId" alt="alt" width="300" height="200" /&gt;</code>
                  </span>
                </label>
                <label class="row">
                  <input type="radio" name="targetSyntax" value="markdown"${markdownCheckedAttr}>
                  <span style="display:flex;flex-direction:column;gap:2px;">
                    <span>Markdown (original size only)</span>
                    <code style="font-size:11px;opacity:0.7;">![alt](:/resourceId)</code>
                  </span>
                </label>
                <div class="hint" style="margin-top:8px;">Note: Resize settings are only available when HTML syntax is selected. Choose Markdown to revert to the original markdown embed.</div>
              </div>
            </div>
          </fieldset>

          <fieldset class="${resizeFieldsetClass}" data-resize-fieldset>
            <legend>Resizing</legend>
            <div class="grid">
              <div class="row">
                <input type="radio" id="percentageMode" name="resizeMode" value="percentage"${percentageModeCheckedAttr}>
                <label for="percentageMode">Percentage</label>
              </div>
              <div class="${percentageRowClass}" data-percentage-row>
                <input type="number" name="percentage" value="50" min="1" max="500"${percentageDisabledAttr}>
                <span>%</span>
              </div>
              <div class="row">
                <input type="radio" id="absoluteMode" name="resizeMode" value="absolute"${absoluteModeCheckedAttr}>
                <label for="absoluteMode">Absolute size</label>
              </div>
              <div class="${absoluteGroupClass}" data-absolute-group>
                <div class="row">
                  <label for="absoluteWidth" style="width:55px;">Width</label>
                  <input type="number" name="absoluteWidth" id="absoluteWidth" placeholder="${originalWidth}"${absoluteDisabledAttr}>
                  <span>px</span>
                </div>
                <div class="row">
                  <label for="absoluteHeight" style="width:55px;">Height</label>
                  <input type="number" name="absoluteHeight" id="absoluteHeight" placeholder="${originalHeight}"${absoluteDisabledAttr}>
                  <span>px</span>
                </div>
              </div>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
        `
    );
    const result = await joplin.views.dialogs.open(dialogHandle);

    if (result.id === 'ok' && result.formData) {
        const form = result.formData.resizeForm;
        if (!form) {
            return null;
        }
        const targetSyntax = (form.targetSyntax as 'markdown' | 'html') || 'html';
        const altText = typeof form.altText === 'string' ? form.altText : '';
        const resizeMode = (form.resizeMode as 'percentage' | 'absolute') || 'percentage';

        return {
            targetSyntax,
            altText,
            resizeMode,
            percentage: form.percentage ? parseInt(form.percentage, 10) : undefined,
            absoluteWidth: form.absoluteWidth ? parseInt(form.absoluteWidth, 10) : undefined,
            absoluteHeight: form.absoluteHeight ? parseInt(form.absoluteHeight, 10) : undefined,
        };
    }

    return null;
}
