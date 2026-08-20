/**
 * Dialog script for image resize functionality.
 *
 * This runs in Joplin's dialog webview, not in the plugin host.
 * So runtime imports are only safe when the imported module is browser-compatible.
 */

import type { ImageSyntax, ResizeDialogConfig, ResizeMode } from '../types';

// The generated bundle ends with `exports.default = ...`, but Joplin executes
// dialog scripts as browser scripts without providing `exports`.
const dialogGlobal = globalThis as typeof globalThis & { exports?: Record<string, unknown> };
dialogGlobal.exports ??= {};

(() => {
    const root = document.getElementById('dialog-root') as HTMLDivElement | null;
    if (!root) return;

    // Parse configuration from single JSON attribute. The plugin host always writes
    // this attribute before opening the dialog, so a missing value means there is no
    // dialog to wire up; past that point the payload is a trusted internal contract.
    const rawConfig = root.dataset.config;
    if (!rawConfig) return;
    const config: ResizeDialogConfig = JSON.parse(rawConfig);

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

    const defaultResizeMode = config.defaultResizeMode;
    const percentageAvailable = config.originalDimensionsDetermined;
    const initialSyntax: ImageSyntax = 'html';
    const originalWidthValue = config.originalWidth;
    const originalHeightValue = config.originalHeight;
    const defaultWidth = String(originalWidthValue);
    const defaultHeight = String(originalHeightValue);

    let currentSyntax: ImageSyntax = initialSyntax;
    let currentResizeMode: ResizeMode = defaultResizeMode;

    const shouldSyncDimensions = (): boolean =>
        config.originalDimensionsDetermined && currentSyntax === 'html' && currentResizeMode === 'absolute';

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
        if (mode === 'percentage' && !percentageAvailable) {
            mode = 'absolute';
        }
        currentResizeMode = mode;
        const htmlActive = currentSyntax === 'html';
        const isPercentage = mode === 'percentage';

        const percentageDisabled = !htmlActive || !isPercentage;
        const absoluteDisabled = !htmlActive || isPercentage;

        setRowDisabled(percentageModeRow, !percentageAvailable);
        setRowDisabled(percentageRow, percentageDisabled);
        setRowDisabled(absoluteGroup, absoluteDisabled);
        setRowDisabled(heightRow, absoluteDisabled || !config.originalDimensionsDetermined);

        if (htmlActive && isPercentage && !percentageInput.value) {
            percentageInput.value = String(config.defaultPercentage);
        }

        if (htmlActive && !isPercentage) {
            if (!absoluteWidthInput.value) absoluteWidthInput.value = defaultWidth;
            if (config.originalDimensionsDetermined && !absoluteHeightInput.value) {
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
            setRowDisabled(percentageModeRow, !percentageAvailable);
            setRowDisabled(percentageRow, currentResizeMode !== 'percentage');
            setRowDisabled(absoluteGroup, currentResizeMode === 'percentage');
            setRowDisabled(heightRow, currentResizeMode === 'percentage' || !config.originalDimensionsDetermined);
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
})();
