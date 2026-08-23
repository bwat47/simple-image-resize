import type { ButtonSpec, DialogResult, ViewHandle } from 'api/types';
import type {
    ImageContext,
    ImageSyntax,
    InitialDialogState,
    ResizeDialogConfig,
    ResizeDialogResult,
    ResizeMode,
} from './types';
import { escapeHtmlAttribute } from './utils/stringUtils';

const DIALOG_ID = 'image-resize-dialog';

/** The subset of Joplin's dialog API needed by the resize dialog. */
export interface JoplinDialogApi {
    create(id: string): Promise<ViewHandle>;
    setFitToContent(handle: ViewHandle, status: boolean): Promise<unknown>;
    addScript(handle: ViewHandle, scriptPath: string): Promise<void>;
    setButtons(handle: ViewHandle, buttons: ButtonSpec[]): Promise<unknown>;
    setHtml(handle: ViewHandle, html: string): Promise<unknown>;
    open(handle: ViewHandle): Promise<DialogResult | null>;
}

export interface ResizeDialogDefaults {
    defaultResizeMode: ResizeMode;
    defaultPercentage: number;
}

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
        heightRowClass: `row${heightInitiallyDisabled && !absoluteInitiallyDisabled ? ' is-disabled' : ''}`,
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
 * Renders the dialog markup for one image. Exported so webview tests can drive the
 * real markup instead of a hand-maintained copy of it.
 */
export function renderDialogHtml(context: ImageContext, defaults: ResizeDialogDefaults): string {
    const originalWidth = context.originalDimensions.width;
    const originalHeight = context.originalDimensions.height;
    const defaultSyntax: ImageSyntax = 'html';
    const { defaultResizeMode, defaultPercentage } = defaults;

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

    return `
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
        `;
}

/** Owns the reusable Joplin dialog handle and prevents overlapping opens. */
export class ResizeDialog {
    private handle: Promise<ViewHandle> | null = null;
    private configured: Promise<void> | null = null;
    private isOpen = false;

    public constructor(private readonly dialogs: JoplinDialogApi) {}

    /**
     * Creates the dialog once and shares it with every caller.
     *
     * The handle only exists after an await, so caching the resolved value would let
     * a second caller pass the "already created?" check before the first finished,
     * creating a duplicate view. Caching the promises makes concurrent callers share
     * one dialog.
     *
     * Creation is never retried: Joplin derives the view handle from the dialog id and
     * throws "View already added" when that id is registered twice, so a second
     * create() would break the dialog for the rest of the session. Only the
     * configuration steps are discarded on failure, so a later open re-applies them to
     * the handle that already exists.
     */
    private async ensureHandle(): Promise<ViewHandle> {
        this.handle ??= this.dialogs.create(DIALOG_ID);
        const handle = await this.handle;

        this.configured ??= this.configureHandle(handle).catch((error: unknown) => {
            this.configured = null;
            throw error;
        });
        await this.configured;

        return handle;
    }

    private async configureHandle(handle: ViewHandle): Promise<void> {
        await this.dialogs.setFitToContent(handle, true);
        await this.dialogs.addScript(handle, './dialog/resizeDialog.css');
        await this.dialogs.addScript(handle, './dialog/resizeDialog.js');
        await this.dialogs.setButtons(handle, [
            { id: 'ok', title: 'Resize image' },
            { id: 'cancel', title: 'Cancel' },
        ]);
    }

    /** Renders current image data and waits for the user to dismiss the dialog. */
    public async open(context: ImageContext, defaults: ResizeDialogDefaults): Promise<ResizeDialogResult | null> {
        // A second open() makes Joplin resolve the *pending* first one with null and hand
        // the dialog to the new caller, so an unguarded repeat would cancel the request
        // the user is looking at. Set before the first await so none can slip through.
        if (this.isOpen) return null;
        this.isOpen = true;

        try {
            const handle = await this.ensureHandle();
            await this.dialogs.setHtml(handle, renderDialogHtml(context, defaults));
            const result = await this.dialogs.open(handle);

            if (result?.id !== 'ok' || !result.formData) return null;

            const form = result.formData.resizeForm;
            if (!form) return null;

            const targetSyntax = (form.targetSyntax as ImageSyntax) || 'html';
            const altText = typeof form.altText === 'string' ? form.altText : '';
            const resizeMode =
                (form.resizeMode as ResizeMode) ||
                (context.originalDimensionsDetermined ? defaults.defaultResizeMode : 'absolute');

            return {
                targetSyntax,
                altText,
                resizeMode,
                percentage: form.percentage ? parseInt(form.percentage, 10) : undefined,
                absoluteWidth: form.absoluteWidth ? parseInt(form.absoluteWidth, 10) : undefined,
                absoluteHeight: form.absoluteHeight ? parseInt(form.absoluteHeight, 10) : undefined,
            };
        } finally {
            this.isOpen = false;
        }
    }
}
