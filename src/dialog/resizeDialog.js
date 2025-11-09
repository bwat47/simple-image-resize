/**
 * Dialog script for image resize functionality.
 *
 * This TypeScript file is compiled to JavaScript during the build process.
 * The compiled .js file is auto-generated - do not edit it directly.
 *
 * To make changes: Edit this .ts file and run `npm run dist` or `npm run compile:dialog`
 *
 * Constants are inlined (not imported) to avoid webpack module bundling issues,
 * since dialog scripts run in a plain browser context without module support.
 */
const SYNTAX_TYPES = {
    HTML: 'html',
    MARKDOWN: 'markdown',
};
const RESIZE_MODES = {
    PERCENTAGE: 'percentage',
    ABSOLUTE: 'absolute',
};
(() => {
    const root = document.getElementById('dialog-root');
    if (!root)
        return;
    const form = document.forms.namedItem('resizeForm');
    if (!form)
        return;
    const syntaxRadios = Array.from(form.querySelectorAll('input[name="targetSyntax"]'));
    const modeRadios = Array.from(form.querySelectorAll('input[name="resizeMode"]'));
    const percentageInput = form.querySelector('input[name="percentage"]');
    const percentageRow = form.querySelector('[data-percentage-row]');
    const absoluteWidthInput = form.querySelector('input[name="absoluteWidth"]');
    const absoluteHeightInput = form.querySelector('input[name="absoluteHeight"]');
    const absoluteGroup = form.querySelector('[data-absolute-group]');
    const resizeFieldset = form.querySelector('[data-resize-fieldset]');
    if (!percentageInput ||
        !percentageRow ||
        !absoluteWidthInput ||
        !absoluteHeightInput ||
        !absoluteGroup ||
        !resizeFieldset) {
        return;
    }
    const defaultResizeMode = root.dataset.defaultResizeMode || RESIZE_MODES.PERCENTAGE;
    const initialSyntax = SYNTAX_TYPES.HTML;
    const defaultWidth = root.dataset.originalWidth || '';
    const defaultHeight = root.dataset.originalHeight || '';
    const originalWidthValue = Number.parseFloat(defaultWidth);
    const originalHeightValue = Number.parseFloat(defaultHeight);
    const hasOriginalDimensions = Number.isFinite(originalWidthValue) &&
        Number.isFinite(originalHeightValue) &&
        originalWidthValue > 0 &&
        originalHeightValue > 0;
    let currentSyntax = initialSyntax;
    let currentResizeMode = defaultResizeMode;
    const shouldSyncDimensions = () => currentSyntax === SYNTAX_TYPES.HTML && currentResizeMode === RESIZE_MODES.ABSOLUTE && hasOriginalDimensions;
    const shouldPreviewPercentage = () => currentSyntax === SYNTAX_TYPES.HTML && currentResizeMode === RESIZE_MODES.PERCENTAGE && hasOriginalDimensions;
    /**
     * Syncs target dimension from source dimension while preserving aspect ratio.
     */
    const syncDimension = (sourceInput, targetInput, sourceOrig, targetOrig) => {
        const raw = sourceInput.value.trim();
        if (!raw) {
            targetInput.value = '';
            return;
        }
        const sourceValue = Number.parseFloat(raw);
        if (!Number.isFinite(sourceValue))
            return;
        if (sourceValue <= 0) {
            targetInput.value = '';
            return;
        }
        if (!shouldSyncDimensions())
            return;
        const newTargetValue = Math.max(1, Math.round((sourceValue / sourceOrig) * targetOrig));
        if (Number.isFinite(newTargetValue)) {
            targetInput.value = String(newTargetValue);
        }
    };
    const syncHeightFromWidth = () => {
        syncDimension(absoluteWidthInput, absoluteHeightInput, originalWidthValue, originalHeightValue);
    };
    const syncWidthFromHeight = () => {
        syncDimension(absoluteHeightInput, absoluteWidthInput, originalHeightValue, originalWidthValue);
    };
    const syncAbsoluteFromPercentage = () => {
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
    const setRowDisabled = (element, disabled) => {
        element.classList.toggle('is-disabled', disabled);
        element
            .querySelectorAll('input, select, textarea, button')
            .forEach((field) => {
            field.disabled = disabled;
        });
    };
    const applyResizeMode = (mode) => {
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
            if (!absoluteWidthInput.value && defaultWidth)
                absoluteWidthInput.value = defaultWidth;
            if (!absoluteHeightInput.value && defaultHeight)
                absoluteHeightInput.value = defaultHeight;
        }
        if (htmlActive && isPercentage) {
            syncAbsoluteFromPercentage();
        }
    };
    const applySyntaxMode = (syntax) => {
        currentSyntax = syntax;
        const htmlActive = syntax === SYNTAX_TYPES.HTML;
        resizeFieldset.classList.toggle('is-locked', !htmlActive);
        if (!htmlActive) {
            setRowDisabled(percentageRow, true);
            setRowDisabled(absoluteGroup, true);
        }
        else {
            setRowDisabled(percentageRow, currentResizeMode !== RESIZE_MODES.PERCENTAGE);
            setRowDisabled(absoluteGroup, currentResizeMode === RESIZE_MODES.PERCENTAGE);
        }
        applyResizeMode(currentResizeMode);
    };
    syntaxRadios.forEach((radio) => {
        if (radio.value === initialSyntax)
            radio.checked = true;
        radio.addEventListener('change', () => applySyntaxMode(radio.value));
    });
    absoluteWidthInput.addEventListener('input', syncHeightFromWidth);
    absoluteHeightInput.addEventListener('input', syncWidthFromHeight);
    percentageInput.addEventListener('input', () => {
        syncAbsoluteFromPercentage();
    });
    modeRadios.forEach((radio) => {
        if (radio.value === defaultResizeMode)
            radio.checked = true;
        radio.addEventListener('change', () => applyResizeMode(radio.value));
    });
    applySyntaxMode(initialSyntax);
    applyResizeMode(defaultResizeMode);
})();
