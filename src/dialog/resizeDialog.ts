/**
 * Dialog script for image resize functionality.
 *
 * This TypeScript file is compiled to JavaScript during the build process.
 * The compiled .js file is auto-generated - do not edit it directly.
 *
 * To make changes: Edit this .ts file and run `npm run dist` or `npm run compile:dialog`
 *
 * Constants are inlined (not imported from src\constants.ts) to avoid webpack bundling issues,
 * since dialog scripts run in a plain browser context without module support.
 */

const SYNTAX_TYPES = {
    HTML: 'html',
    MARKDOWN: 'markdown',
} as const;

const RESIZE_MODES = {
    PERCENTAGE: 'percentage',
    ABSOLUTE: 'absolute',
} as const;

type SyntaxType = 'html' | 'markdown';
type ResizeMode = 'percentage' | 'absolute';

(() => {
    const root = document.getElementById('dialog-root') as HTMLDivElement | null;
    if (!root) return;

    const form = document.forms.namedItem('resizeForm');
    if (!form) return;

    const syntaxRadios = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="targetSyntax"]'));
    const modeRadios = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="resizeMode"]'));
    const percentageInput = form.querySelector<HTMLInputElement>('input[name="percentage"]');
    const percentageRow = form.querySelector<HTMLElement>('[data-percentage-row]');
    const absoluteWidthInput = form.querySelector<HTMLInputElement>('input[name="absoluteWidth"]');
    const absoluteHeightInput = form.querySelector<HTMLInputElement>('input[name="absoluteHeight"]');
    const absoluteGroup = form.querySelector<HTMLElement>('[data-absolute-group]');
    const resizeFieldset = form.querySelector<HTMLElement>('[data-resize-fieldset]');

    if (
        !percentageInput ||
        !percentageRow ||
        !absoluteWidthInput ||
        !absoluteHeightInput ||
        !absoluteGroup ||
        !resizeFieldset
    ) {
        return;
    }

    const defaultResizeMode = (root.dataset.defaultResizeMode as ResizeMode) || RESIZE_MODES.PERCENTAGE;
    const initialSyntax: SyntaxType = SYNTAX_TYPES.HTML;
    const defaultWidth = root.dataset.originalWidth || '';
    const defaultHeight = root.dataset.originalHeight || '';
    const originalWidthValue = Number.parseFloat(defaultWidth);
    const originalHeightValue = Number.parseFloat(defaultHeight);
    const hasOriginalDimensions =
        Number.isFinite(originalWidthValue) &&
        Number.isFinite(originalHeightValue) &&
        originalWidthValue > 0 &&
        originalHeightValue > 0;

    let currentSyntax: SyntaxType = initialSyntax;
    let currentResizeMode: ResizeMode = defaultResizeMode;

    const shouldSyncDimensions = (): boolean =>
        currentSyntax === SYNTAX_TYPES.HTML && currentResizeMode === RESIZE_MODES.ABSOLUTE && hasOriginalDimensions;

    const shouldPreviewPercentage = (): boolean =>
        currentSyntax === SYNTAX_TYPES.HTML && currentResizeMode === RESIZE_MODES.PERCENTAGE && hasOriginalDimensions;

    /**
     * Syncs target dimension from source dimension while preserving aspect ratio.
     */
    const syncDimension = (
        sourceInput: HTMLInputElement,
        targetInput: HTMLInputElement,
        sourceOrig: number,
        targetOrig: number
    ): void => {
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
        if (!shouldSyncDimensions()) return;
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
        currentResizeMode = mode;
        const htmlActive = currentSyntax === SYNTAX_TYPES.HTML;
        const isPercentage = mode === RESIZE_MODES.PERCENTAGE;

        const percentageDisabled = !htmlActive || !isPercentage;
        const absoluteDisabled = !htmlActive || isPercentage;

        percentageInput.disabled = percentageDisabled;
        percentageRow.classList.toggle('is-disabled', percentageDisabled);

        absoluteWidthInput.disabled = absoluteDisabled;
        absoluteHeightInput.disabled = absoluteDisabled;
        absoluteGroup.classList.toggle('is-disabled', absoluteDisabled);

        if (htmlActive && isPercentage && !percentageInput.value) {
            percentageInput.value = '50';
        }

        if (htmlActive && !isPercentage) {
            if (!absoluteWidthInput.value && defaultWidth) absoluteWidthInput.value = defaultWidth;
            if (!absoluteHeightInput.value && defaultHeight) absoluteHeightInput.value = defaultHeight;
        }

        if (htmlActive && isPercentage) {
            syncAbsoluteFromPercentage();
        }
    };

    const applySyntaxMode = (syntax: SyntaxType): void => {
        currentSyntax = syntax;
        const htmlActive = syntax === SYNTAX_TYPES.HTML;

        resizeFieldset.classList.toggle('is-locked', !htmlActive);

        if (!htmlActive) {
            setRowDisabled(percentageRow, true);
            setRowDisabled(absoluteGroup, true);
        } else {
            setRowDisabled(percentageRow, currentResizeMode !== RESIZE_MODES.PERCENTAGE);
            setRowDisabled(absoluteGroup, currentResizeMode === RESIZE_MODES.PERCENTAGE);
        }

        applyResizeMode(currentResizeMode);
    };

    syntaxRadios.forEach((radio) => {
        if (radio.value === initialSyntax) radio.checked = true;
        radio.addEventListener('change', () => applySyntaxMode(radio.value as SyntaxType));
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
