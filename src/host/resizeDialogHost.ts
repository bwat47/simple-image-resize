import type { ButtonSpec, DialogResult, VersionInfo, ViewHandle } from 'api/types';
import type { ImageContext, ImageSyntax, ResizeDialogConfig, ResizeDialogResult, ResizeMode } from '../shared/types';
import { getDialogFieldState } from '../shared/dialogFieldState';
import { escapeHtmlAttribute } from '../shared/stringUtils';
import { desktopDialogCss, resizeDialogCss } from './resizeDialogStyles';

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

export type DialogPlatform = VersionInfo['platform'];

export interface ResizeDialogDefaults {
    defaultResizeMode: ResizeMode;
    defaultPercentage: number;
}

/** Precomputed CSS classes and HTML attributes used to render the resize dialog's initial state. */
export interface InitialDialogState {
    // CSS classes
    resizeSectionClass: string;
    percentageModeRowClass: string;
    percentageRowClass: string;
    absoluteGroupClass: string;
    heightRowClass: string;
    // HTML checked attributes
    htmlCheckedAttr: string;
    markdownCheckedAttr: string;
    percentageModeCheckedAttr: string;
    absoluteModeCheckedAttr: string;
    // HTML disabled attributes
    percentageDisabledAttr: string;
    percentageModeDisabledAttr: string;
    absoluteDisabledAttr: string;
    heightDisabledAttr: string;
}

/**
 * Renders the initial control state as markup classes and attributes, so the dialog
 * opens in the right state before its script runs. The rules themselves live in
 * getDialogFieldState, which the webview applies on every change.
 */
export function getInitialDialogState(
    defaultSyntax: ImageSyntax,
    defaultResizeMode: ResizeMode,
    originalDimensionsDetermined: boolean
): InitialDialogState {
    const state = getDialogFieldState(defaultSyntax, defaultResizeMode, originalDimensionsDetermined);
    const htmlSyntaxSelected = defaultSyntax === 'html';
    const percentageModeSelected = state.resizeMode === 'percentage';
    const disabledClass = (disabled: boolean): string => (disabled ? ' is-disabled' : '');
    const disabledAttr = (disabled: boolean): string => (disabled ? ' disabled' : '');
    const checkedAttr = (checked: boolean): string => (checked ? ' checked' : '');

    return {
        resizeSectionClass: `subgrid resize-section${state.resizeLocked ? ' is-locked' : ''}`,
        percentageModeRowClass: `segment${disabledClass(state.percentageModeDisabled)}`,
        percentageRowClass: `subgrid${disabledClass(state.percentageDisabled)}`,
        absoluteGroupClass: `subgrid${disabledClass(state.absoluteDisabled)}`,
        heightRowClass: `subgrid${disabledClass(state.heightDimmed)}`,
        htmlCheckedAttr: checkedAttr(htmlSyntaxSelected),
        markdownCheckedAttr: checkedAttr(!htmlSyntaxSelected),
        percentageModeCheckedAttr: checkedAttr(percentageModeSelected),
        absoluteModeCheckedAttr: checkedAttr(!percentageModeSelected),
        percentageDisabledAttr: disabledAttr(state.percentageDisabled),
        percentageModeDisabledAttr: disabledAttr(state.percentageModeDisabled),
        absoluteDisabledAttr: disabledAttr(state.absoluteDisabled),
        heightDisabledAttr: disabledAttr(state.heightDisabled),
    };
}

export function getOriginalDimensionsText(context: ImageContext): string {
    if (!context.originalDimensionsDetermined) {
        return 'Unknown';
    }

    return `${context.originalDimensions.width} × ${context.originalDimensions.height} px`;
}

function getHeightPlaceholderAttribute(context: ImageContext): string {
    return context.originalDimensionsDetermined ? ` placeholder="${context.originalDimensions.height}"` : '';
}

/**
 * Renders the dialog markup for one image. Exported so webview tests can drive the
 * real markup instead of a hand-maintained copy of it.
 */
export function renderDialogHtml(
    context: ImageContext,
    defaults: ResizeDialogDefaults,
    platform: DialogPlatform
): string {
    const originalWidth = context.originalDimensions.width;
    const originalHeight = context.originalDimensions.height;
    const defaultSyntax: ImageSyntax = 'html';
    const { defaultResizeMode, defaultPercentage } = defaults;

    const {
        resizeSectionClass,
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
    const originalDimensionsText = getOriginalDimensionsText(context);
    const heightPlaceholderAttr = getHeightPlaceholderAttribute(context);

    // Read by the dialog script from the root's `data-config` attribute.
    const dialogConfig: ResizeDialogConfig = {
        defaultResizeMode: getDialogFieldState(defaultSyntax, defaultResizeMode, context.originalDimensionsDetermined)
            .resizeMode,
        defaultPercentage,
        originalWidth,
        originalHeight,
        originalDimensionsDetermined: context.originalDimensionsDetermined,
    };

    return `
    <style>${resizeDialogCss}${platform === 'desktop' ? desktopDialogCss : ''}</style>
    <div id="dialog-root" class="container" data-config="${escapeHtmlAttribute(JSON.stringify(dialogConfig))}">
      <h4>Resize Image</h4>
      <form name="resizeForm" autocomplete="off" class="grid">
        <span class="field-label">Original</span>
        <span>${originalDimensionsText}</span>
        <label for="altText" class="field-label">Alt text</label>
        <div class="row">
          <input type="text" id="altText" name="altText" value="${escapeHtmlAttribute(context.altText)}" placeholder="Describe the image">
        </div>
        <span id="syntaxLabel" class="field-label">Syntax</span>
        <div class="segmented" role="radiogroup" aria-labelledby="syntaxLabel">
          <label class="segment">
            <input type="radio" name="targetSyntax" value="html"${htmlCheckedAttr}>
            <span>HTML</span>
          </label>
          <label class="segment">
            <input type="radio" name="targetSyntax" value="markdown"${markdownCheckedAttr}>
            <span>Markdown</span>
          </label>
        </div>
        <div class="${resizeSectionClass}" data-resize-section>
          <span id="resizeModeLabel" class="field-label">Resize by</span>
          <div class="segmented" role="radiogroup" aria-labelledby="resizeModeLabel">
            <label class="${percentageModeRowClass}" data-percentage-mode-row>
              <input type="radio" name="resizeMode" value="percentage"${percentageModeCheckedAttr}${percentageModeDisabledAttr}>
              <span>Percentage</span>
            </label>
            <label class="segment">
              <input type="radio" name="resizeMode" value="absolute"${absoluteModeCheckedAttr}>
              <span>Pixels</span>
            </label>
          </div>
          <div class="subgrid mode-panels">
            <div class="${percentageRowClass}" data-percentage-row>
              <label for="percentage" class="field-label">Scale</label>
              <div class="row">
                <input type="number" name="percentage" id="percentage" value="${defaultPercentage}" min="1" max="500"${percentageDisabledAttr}>
                <span>%</span>
              </div>
              <p class="hint" data-percentage-preview></p>
            </div>
            <div class="${absoluteGroupClass}" data-absolute-group>
              <label for="absoluteWidth" class="field-label">Width</label>
              <div class="row">
                <input type="number" name="absoluteWidth" id="absoluteWidth" placeholder="${originalWidth}"${absoluteDisabledAttr}>
                <span>px</span>
              </div>
              <div class="${heightRowClass}" data-height-row>
                <label for="absoluteHeight" class="field-label">Height</label>
                <div class="row">
                  <input type="number" name="absoluteHeight" id="absoluteHeight"${heightPlaceholderAttr}${heightDisabledAttr}>
                  <span>px</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
        `;
}

/** Owns the reusable Joplin dialog handle and prevents overlapping opens. */
export class ResizeDialog {
    private handle: Promise<ViewHandle> | null = null;
    private configured: Promise<void> | null = null;
    private isOpen = false;

    public constructor(
        private readonly dialogs: JoplinDialogApi,
        private readonly platform: DialogPlatform
    ) {}

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
            await this.dialogs.setHtml(handle, renderDialogHtml(context, defaults, this.platform));
            const result = await this.dialogs.open(handle);

            if (result?.id !== 'ok' || !result.formData) return null;

            const formData: unknown = result.formData;
            if (typeof formData !== 'object' || formData === null || !('resizeForm' in formData)) return null;
            const form = formData.resizeForm;
            if (typeof form !== 'object' || form === null) return null;
            const fields = form as Record<string, unknown>;

            const targetSyntax = fields.targetSyntax === 'markdown' ? 'markdown' : 'html';
            const altText = typeof fields.altText === 'string' ? fields.altText : '';
            const defaultResizeMode = getDialogFieldState(
                targetSyntax,
                defaults.defaultResizeMode,
                context.originalDimensionsDetermined
            ).resizeMode;
            const resizeMode =
                fields.resizeMode === 'percentage' || fields.resizeMode === 'absolute'
                    ? fields.resizeMode
                    : defaultResizeMode;

            const readDimension = (value: unknown): number | undefined =>
                typeof value === 'string' && value ? parseInt(value, 10) : undefined;

            return {
                targetSyntax,
                altText,
                resizeMode,
                percentage: readDimension(fields.percentage),
                absoluteWidth: readDimension(fields.absoluteWidth),
                absoluteHeight: readDimension(fields.absoluteHeight),
            };
        } finally {
            this.isOpen = false;
        }
    }
}
