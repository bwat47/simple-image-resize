import joplin from 'api';
import { ImageContext, ResizeDialogResult } from './types';
import { escapeHtmlAttribute } from './stringUtils';

/**
 * Calculates the initial state for the dialog based on default syntax and resize mode.
 * Centralizes all state calculation logic to avoid duplication and improve maintainability.
 */
export function getInitialDialogState(
    defaultSyntax: 'html' | 'markdown',
    defaultResizeMode: 'percentage' | 'absolute'
) {
    const htmlSyntaxSelected = defaultSyntax === 'html';
    const percentageModeDefault = defaultResizeMode === 'percentage';
    const percentageInitiallyDisabled = !htmlSyntaxSelected || !percentageModeDefault;
    const absoluteInitiallyDisabled = !htmlSyntaxSelected || percentageModeDefault;

    return {
        // CSS classes
        resizeFieldsetClass: `resize-fieldset${htmlSyntaxSelected ? '' : ' is-locked'}`,
        percentageRowClass: `row${percentageInitiallyDisabled ? ' is-disabled' : ''}`,
        absoluteGroupClass: `stack absolute-size-group${absoluteInitiallyDisabled ? ' is-disabled' : ''}`,
        // HTML checked attributes
        htmlCheckedAttr: htmlSyntaxSelected ? ' checked' : '',
        markdownCheckedAttr: htmlSyntaxSelected ? '' : ' checked',
        percentageModeCheckedAttr: percentageModeDefault ? ' checked' : '',
        absoluteModeCheckedAttr: percentageModeDefault ? '' : ' checked',
        // HTML disabled attributes
        percentageDisabledAttr: percentageInitiallyDisabled ? ' disabled' : '',
        absoluteDisabledAttr: absoluteInitiallyDisabled ? ' disabled' : '',
    };
}

/**
 * Shows the image resize dialog and returns the user's selections.
 *
 * @param context - Image metadata including dimensions, source, and alt text
 * @param defaultResizeMode - Default resize mode to preselect in the dialog
 * @returns User's dialog selections, or null if canceled
 */
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

    const {
        resizeFieldsetClass,
        percentageRowClass,
        absoluteGroupClass,
        htmlCheckedAttr,
        markdownCheckedAttr,
        percentageModeCheckedAttr,
        absoluteModeCheckedAttr,
        percentageDisabledAttr,
        absoluteDisabledAttr,
    } = getInitialDialogState(defaultSyntax, defaultResizeMode);

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
        background-color: var(--joplin-background-color, #ffffff);
        color: var(--joplin-color, #32373F);
      }
      .container {
        padding: 22px 26px 30px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        width: 100%;
      }
      h4 { margin: 0 0 10px; font-size: 16px; color: var(--joplin-color, #32373F); }
      form { display: flex; flex-direction: column; gap: 22px; width: 100%; }
      fieldset {
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 6px;
        padding: 18px 20px 20px;
        margin: 0;
        min-width: 0;
        width: 100%;
        transition: opacity 0.2s ease, background-color 0.2s ease;
      }
      legend { font-weight: 600; color: var(--joplin-color, #32373F); }
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
      label { user-select: none; cursor: pointer; color: var(--joplin-color, #32373F); }
      input[type=number] {
        width: 92px;
        padding: 4px 6px;
        background-color: var(--joplin-background-color, #ffffff);
        color: var(--joplin-color, #32373F);
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 3px;
        transition: background-color 0.2s ease, opacity 0.2s ease;
        outline: none;
      }
      input[type=text] {
        width: 100%;
        padding: 6px 8px;
        min-width: 0;
        background-color: var(--joplin-background-color, #ffffff);
        color: var(--joplin-color, #32373F);
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 3px;
        transition: background-color 0.2s ease;
        outline: none;
      }
      input[type=radio] { cursor: pointer; }
      .hint {
        font-size: 11px;
        opacity: 0.7;
        margin-top: 4px;
        color: var(--joplin-color-faded, #7C8B9E);
        transition: opacity 0.2s ease;
      }
      .row.is-disabled,
      .stack.is-disabled { opacity: 0.6 }
      .row.is-disabled input,
      .stack.is-disabled input {
        background-color: var(--joplin-raised-background-color, #e5e5e5);
        cursor: not-allowed;
      }
      .stack.is-disabled .hint { opacity: 0.4 }
      .resize-fieldset.is-locked {
        opacity: 0.4;
        pointer-events: none;
        background-color: var(--joplin-background-color3, #F4F5F6);
      }
      .resize-fieldset.is-locked input {
        cursor: not-allowed;
      }

      /* Code examples styling */
      code {
        background-color: var(--joplin-code-background-color, rgb(243, 243, 243));
        color: var(--joplin-code-color, rgb(0, 0, 0));
        padding: 2px 4px;
        border-radius: 3px;
        border: 1px solid var(--joplin-code-border-color, rgb(220, 220, 220));
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
