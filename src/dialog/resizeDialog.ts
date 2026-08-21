/**
 * Dialog script for image resize functionality.
 *
 * This runs in Joplin's dialog webview, not in the plugin host.
 * So runtime imports are only safe when the imported module is browser-compatible.
 */

import type { ImageSyntax, ResizeDialogConfig, ResizeMode } from '../types';
import { logger } from '../logger';

// The generated bundle ends with `exports.default = ...`, but Joplin executes
// dialog scripts as browser scripts without providing `exports`.
const dialogGlobal = globalThis as typeof globalThis & { exports?: Record<string, unknown> };
dialogGlobal.exports ??= {};

function initializeResizeDialog(): void {
    const root = document.getElementById('dialog-root') as HTMLDivElement | null;
    if (!root || root.dataset.initialized === 'true') return;

    // Parse configuration from single JSON attribute. The plugin host always writes
    // this attribute before opening the dialog, so a missing value means there is no
    // dialog to wire up; past that point the payload is a trusted internal contract.
    const rawConfig = root.dataset.config;
    if (!rawConfig) return;

    let config: ResizeDialogConfig;
    try {
        config = JSON.parse(rawConfig);
    } catch (error) {
        // Unlike the checks above, a malformed payload never becomes valid, so mark the
        // root done rather than let a second entry log the same failure again.
        root.dataset.initialized = 'true';
        logger.error('Invalid dialog config.', error);
        return;
    }

    const form = document.forms.namedItem('resizeForm');
    if (!form) return;

    const syntaxRadios = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="targetSyntax"]'));
    const modeRadios = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="resizeMode"]'));
    const percentageInput = form.querySelector<HTMLInputElement>('input[name="percentage"]');
    const percentageModeRow = form.querySelector<HTMLElement>('[data-percentage-mode-row]');
    const percentageRow = form.querySelector<HTMLElement>('[data-percentage-row]');
    const absoluteWidthInput = form.querySelector<HTMLInputElement>('input[name="absoluteWidth"]');
    const absoluteHeightInput = form.querySelector<HTMLInputElement>('input[name="absoluteHeight"]');
    const heightRow = form.querySelector<HTMLElement>('[data-height-row]');
    const absoluteGroup = form.querySelector<HTMLElement>('[data-absolute-group]');
    const resizeFieldset = form.querySelector<HTMLElement>('[data-resize-fieldset]');

    if (
        !percentageInput ||
        !percentageModeRow ||
        !percentageRow ||
        !absoluteWidthInput ||
        !absoluteHeightInput ||
        !heightRow ||
        !absoluteGroup ||
        !resizeFieldset
    ) {
        return;
    }
    root.dataset.initialized = 'true';

    const defaultResizeMode = config.defaultResizeMode;
    const originalDimensionsDetermined = config.originalDimensionsDetermined;
    const initialSyntax: ImageSyntax = 'html';
    const originalWidthValue = config.originalWidth;
    const originalHeightValue = config.originalHeight;
    const defaultWidth = String(originalWidthValue);
    const defaultHeight = String(originalHeightValue);

    let currentSyntax: ImageSyntax = initialSyntax;
    let currentResizeMode: ResizeMode = defaultResizeMode;

    const shouldSyncDimensions = (): boolean =>
        originalDimensionsDetermined && currentSyntax === 'html' && currentResizeMode === 'absolute';

    const shouldPreviewPercentage = (): boolean => currentSyntax === 'html' && currentResizeMode === 'percentage';

    /**
     * Syncs target dimension from source dimension while preserving aspect ratio.
     */
    const syncDimension = (
        sourceInput: HTMLInputElement,
        targetInput: HTMLInputElement,
        sourceOrig: number,
        targetOrig: number
    ): void => {
        if (!shouldSyncDimensions()) return;
        const raw = sourceInput.value.trim();
        if (!raw) {
            targetInput.value = '';
            return;
        }
        const sourceValue = Number.parseFloat(raw);
        if (!Number.isFinite(sourceValue)) return;
        if (sourceValue <= 0) {
            targetInput.value = '';
            return;
        }
        const newTargetValue = Math.max(1, Math.round((sourceValue / sourceOrig) * targetOrig));
        if (Number.isFinite(newTargetValue)) {
            targetInput.value = String(newTargetValue);
        }
    };

    const syncHeightFromWidth = (): void => {
        syncDimension(absoluteWidthInput, absoluteHeightInput, originalWidthValue, originalHeightValue);
    };

    const syncWidthFromHeight = (): void => {
        syncDimension(absoluteHeightInput, absoluteWidthInput, originalHeightValue, originalWidthValue);
    };

    const syncAbsoluteFromPercentage = (): void => {
        if (!shouldPreviewPercentage()) {
            return;
        }
        const raw = percentageInput.value.trim();
        if (!raw) {
            absoluteWidthInput.value = '';
            absoluteHeightInput.value = '';
            return;
        }
        const percentageValue = Number.parseFloat(raw);
        if (!Number.isFinite(percentageValue) || percentageValue <= 0) {
            absoluteWidthInput.value = '';
            absoluteHeightInput.value = '';
            return;
        }
        const ratio = percentageValue / 100;
        const width = Math.max(1, Math.round(originalWidthValue * ratio));
        const height = Math.max(1, Math.round(originalHeightValue * ratio));
        absoluteWidthInput.value = String(width);
        absoluteHeightInput.value = String(height);
    };

    const setRowDisabled = (element: HTMLElement, disabled: boolean): void => {
        element.classList.toggle('is-disabled', disabled);
        element
            .querySelectorAll<
                HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement
            >('input, select, textarea, button')
            .forEach((field) => {
                field.disabled = disabled;
            });
    };

    const applyResizeMode = (mode: ResizeMode): void => {
        // Percentage resizing has nothing to scale from when the original size is unknown.
        const effectiveMode: ResizeMode = mode === 'percentage' && !originalDimensionsDetermined ? 'absolute' : mode;
        currentResizeMode = effectiveMode;
        const htmlActive = currentSyntax === 'html';
        const isPercentage = effectiveMode === 'percentage';

        const percentageDisabled = !htmlActive || !isPercentage;
        const absoluteDisabled = !htmlActive || isPercentage;

        setRowDisabled(percentageModeRow, !originalDimensionsDetermined);
        setRowDisabled(percentageRow, percentageDisabled);
        setRowDisabled(absoluteGroup, absoluteDisabled);
        setRowDisabled(heightRow, absoluteDisabled || !originalDimensionsDetermined);

        if (htmlActive && isPercentage && !percentageInput.value) {
            percentageInput.value = String(config.defaultPercentage);
        }

        if (htmlActive && !isPercentage) {
            if (!absoluteWidthInput.value) absoluteWidthInput.value = defaultWidth;
            if (originalDimensionsDetermined && !absoluteHeightInput.value) {
                absoluteHeightInput.value = defaultHeight;
            }
        }

        if (htmlActive && isPercentage) {
            syncAbsoluteFromPercentage();
        }
    };

    const applySyntaxMode = (syntax: ImageSyntax): void => {
        currentSyntax = syntax;
        const htmlActive = syntax === 'html';

        resizeFieldset.classList.toggle('is-locked', !htmlActive);

        if (!htmlActive) {
            setRowDisabled(percentageRow, true);
            setRowDisabled(absoluteGroup, true);
            setRowDisabled(heightRow, true);
        } else {
            setRowDisabled(percentageModeRow, !originalDimensionsDetermined);
            setRowDisabled(percentageRow, currentResizeMode !== 'percentage');
            setRowDisabled(absoluteGroup, currentResizeMode === 'percentage');
            setRowDisabled(heightRow, currentResizeMode === 'percentage' || !originalDimensionsDetermined);
        }

        applyResizeMode(currentResizeMode);
    };

    syntaxRadios.forEach((radio) => {
        if (radio.value === initialSyntax) radio.checked = true;
        radio.addEventListener('change', () => applySyntaxMode(radio.value as ImageSyntax));
    });

    absoluteWidthInput.addEventListener('input', syncHeightFromWidth);
    absoluteHeightInput.addEventListener('input', syncWidthFromHeight);
    percentageInput.addEventListener('input', () => {
        syncAbsoluteFromPercentage();
    });

    modeRadios.forEach((radio) => {
        if (radio.value === defaultResizeMode) radio.checked = true;
        radio.addEventListener('change', () => applyResizeMode(radio.value as ResizeMode));
    });

    applySyntaxMode(initialSyntax);
    applyResizeMode(defaultResizeMode);
}

// Joplin remounts the dialog webview on every open and applies the new HTML before
// loading the scripts, so this runs once against markup that is already in place. The
// guard is only so the module can be imported outside a DOM.
if (typeof document !== 'undefined') {
    initializeResizeDialog();
}

export default initializeResizeDialog;
