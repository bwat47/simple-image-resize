import joplin from 'api';
import type {
    ImageContext,
    ImageSyntax,
    InitialDialogState,
    ResizeDialogConfig,
    ResizeDialogResult,
    ResizeMode,
} from './types';
import { escapeHtmlAttribute } from './utils/stringUtils';
import { settingsCache } from './settings';

/**
 * Calculates the initial state for the dialog based on default syntax and resize mode.
 * Centralizes all state calculation logic to avoid duplication and improve maintainability.
 */
export function getInitialDialogState(
    defaultSyntax: ImageSyntax,
    defaultResizeMode: ResizeMode,
    originalDimensionsDetermined: boolean
): InitialDialogState {
    const htmlSyntaxSelected = defaultSyntax === 'html';
    const percentageModeDefault = originalDimensionsDetermined && defaultResizeMode === 'percentage';
    const percentageInitiallyDisabled = !htmlSyntaxSelected || !percentageModeDefault;
    const absoluteInitiallyDisabled = !htmlSyntaxSelected || percentageModeDefault;
    const heightInitiallyDisabled = absoluteInitiallyDisabled || !originalDimensionsDetermined;

    return {
        // CSS classes
        resizeFieldsetClass: `resize-fieldset${htmlSyntaxSelected ? '' : ' is-locked'}`,
        percentageModeRowClass: `row${originalDimensionsDetermined ? '' : ' is-disabled'}`,
        percentageRowClass: `row${percentageInitiallyDisabled ? ' is-disabled' : ''}`,
        absoluteGroupClass: `stack absolute-size-group${absoluteInitiallyDisabled ? ' is-disabled' : ''}`,
        heightRowClass: `row${heightInitiallyDisabled ? ' is-disabled' : ''}`,
        // HTML checked attributes
        htmlCheckedAttr: htmlSyntaxSelected ? ' checked' : '',
        markdownCheckedAttr: htmlSyntaxSelected ? '' : ' checked',
        percentageModeCheckedAttr: percentageModeDefault ? ' checked' : '',
        absoluteModeCheckedAttr: percentageModeDefault ? '' : ' checked',
        // HTML disabled attributes
        percentageDisabledAttr: percentageInitiallyDisabled ? ' disabled' : '',
        percentageModeDisabledAttr: originalDimensionsDetermined ? '' : ' disabled',
        absoluteDisabledAttr: absoluteInitiallyDisabled ? ' disabled' : '',
        heightDisabledAttr: heightInitiallyDisabled ? ' disabled' : '',
    };
}

export function getOriginalDimensionsSummaryHtml(context: ImageContext): string {
    if (!context.originalDimensionsDetermined) {
        return 'Original dimensions could not be determined.';
    }

    return `Original: <strong>${context.originalDimensions.width}px × ${context.originalDimensions.height}px</strong>`;
}

function getHeightPlaceholderAttribute(context: ImageContext): string {
    return context.originalDimensionsDetermined ? ` placeholder="${context.originalDimensions.height}"` : '';
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
    defaultResizeMode: ResizeMode = 'percentage'
): Promise<ResizeDialogResult | null> {
    // We create a new dialog instance for each call to ensure a clean and predictable state.
    const dialogHandle = await joplin.views.dialogs.create(`imageResizeDialog_${Date.now()}`);
    await joplin.views.dialogs.setFitToContent(dialogHandle, true);
    await joplin.views.dialogs.addScript(dialogHandle, './dialog/resizeDialog.css');
    await joplin.views.dialogs.addScript(dialogHandle, './dialog/resizeDialog.js');

    const originalWidth = context.originalDimensions.width;
    const originalHeight = context.originalDimensions.height;
    const defaultSyntax: ImageSyntax = 'html';
    const defaultPercentage = settingsCache.defaultPercentage;

    const {
        resizeFieldsetClass,
        percentageRowClass,
        percentageModeRowClass,
        absoluteGroupClass,
        heightRowClass,
        htmlCheckedAttr,
        markdownCheckedAttr,
        percentageModeCheckedAttr,
        absoluteModeCheckedAttr,
        percentageDisabledAttr,
        percentageModeDisabledAttr,
        absoluteDisabledAttr,
        heightDisabledAttr,
    } = getInitialDialogState(defaultSyntax, defaultResizeMode, context.originalDimensionsDetermined);
    const originalDimensionsSummaryHtml = getOriginalDimensionsSummaryHtml(context);
    const heightPlaceholderAttr = getHeightPlaceholderAttribute(context);

    // Dialog configuration passed as single JSON attribute for cleaner extensibility
    const dialogConfig: ResizeDialogConfig = {
        defaultResizeMode: context.originalDimensionsDetermined ? defaultResizeMode : 'absolute',
        defaultPercentage,
        originalWidth,
        originalHeight,
        originalDimensionsDetermined: context.originalDimensionsDetermined,
    };

    // Always update the HTML and scripts before opening
    await joplin.views.dialogs.setHtml(
        dialogHandle,
        `
    <div id="dialog-root" data-config="${escapeHtmlAttribute(JSON.stringify(dialogConfig))}">
      <!-- Workaround for Joplin dialog focus issue (https://github.com/laurent22/joplin/issues/4474)
           Uses style tag onload since autofocus and inline scripts don't work reliably -->
      <style onload="document.getElementById('altText')?.focus()"></style>
      <div class="container">
        <div>
          <h4>Resize Image</h4>
          <p style="margin:0 0 4px;">${originalDimensionsSummaryHtml}</p>
        </div>
        <form name="resizeForm" autocomplete="off">
          <fieldset>
            <legend>Output</legend>
            <div class="grid narrow">
              <label for="altText" class="label-nowrap">Alt text</label>
              <div class="row" style="padding:0;min-width:0;">
                <input type="text" id="altText" name="altText" value="${escapeHtmlAttribute(context.altText)}" placeholder="Describe the image">
              </div>
              <label class="label-nowrap">Syntax</label>
              <div class="stack">
                <label class="row">
                  <input type="radio" name="targetSyntax" value="html"${htmlCheckedAttr}>
                  <span class="syntax-option">
                    <span>HTML (supports resizing)</span>
                  </span>
                </label>
                <label class="row">
                  <input type="radio" name="targetSyntax" value="markdown"${markdownCheckedAttr}>
                  <span class="syntax-option">
                    <span>Markdown (original size only)</span>
                  </span>
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset class="${resizeFieldsetClass}" data-resize-fieldset>
            <legend>Resizing</legend>
            <div class="grid">
              <div class="${percentageModeRowClass}" data-percentage-mode-row>
                <input type="radio" id="percentageMode" name="resizeMode" value="percentage"${percentageModeCheckedAttr}${percentageModeDisabledAttr}>
                <label for="percentageMode">Percentage</label>
              </div>
              <div class="${percentageRowClass}" data-percentage-row>
                <input type="number" name="percentage" value="${defaultPercentage}" min="1" max="500"${percentageDisabledAttr}>
                <span>%</span>
              </div>
              <div class="row">
                <input type="radio" id="absoluteMode" name="resizeMode" value="absolute"${absoluteModeCheckedAttr}>
                <label for="absoluteMode">Absolute size</label>
              </div>
              <div class="${absoluteGroupClass}" data-absolute-group>
                <div class="row">
                  <label for="absoluteWidth" class="label-fixed">Width</label>
                  <input type="number" name="absoluteWidth" id="absoluteWidth" placeholder="${originalWidth}"${absoluteDisabledAttr}>
                  <span>px</span>
                </div>
                <div class="${heightRowClass}" data-height-row>
                  <label for="absoluteHeight" class="label-fixed">Height</label>
                  <input type="number" name="absoluteHeight" id="absoluteHeight"${heightPlaceholderAttr}${heightDisabledAttr}>
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
    await joplin.views.dialogs.setButtons(dialogHandle, [
        { id: 'ok', title: 'Resize image' },
        { id: 'cancel', title: 'Cancel' },
    ]);
    const result = await joplin.views.dialogs.open(dialogHandle);

    if (result?.id === 'ok' && result.formData) {
        const form = result.formData.resizeForm;
        if (!form) {
            return null;
        }
        const targetSyntax = (form.targetSyntax as ImageSyntax) || 'html';
        const altText = typeof form.altText === 'string' ? form.altText : '';
        const resizeMode =
            (form.resizeMode as ResizeMode) || (context.originalDimensionsDetermined ? defaultResizeMode : 'absolute');

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
