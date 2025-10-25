(() => {
    const root = document.getElementById('dialog-root');
    if (!root) return;

    const form = document.forms.namedItem('resizeForm');
    if (!form) return;

    const syntaxRadios = Array.from(form.querySelectorAll('input[name="targetSyntax"]'));
    const modeRadios = Array.from(form.querySelectorAll('input[name="resizeMode"]'));
    const percentageInput = form.querySelector('input[name="percentage"]');
    const percentageRow = form.querySelector('[data-percentage-row]');
    const absoluteWidthInput = form.querySelector('input[name="absoluteWidth"]');
    const absoluteHeightInput = form.querySelector('input[name="absoluteHeight"]');
    const absoluteGroup = form.querySelector('[data-absolute-group]');
    const resizeFieldset = form.querySelector('[data-resize-fieldset]');

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

    const defaultResizeMode = root.dataset.defaultResizeMode || 'percentage';
    const initialSyntax = 'html';
    const defaultWidth = root.dataset.originalWidth || '';
    const defaultHeight = root.dataset.originalHeight || '';

    let currentSyntax = initialSyntax;
    let currentResizeMode = defaultResizeMode;

    const setRowDisabled = (element, disabled) => {
        element.classList.toggle('is-disabled', disabled);
        element.querySelectorAll('input, select, textarea, button').forEach((field) => {
            field.disabled = disabled;
        });
    };

    const applyResizeMode = (mode) => {
        currentResizeMode = mode;
        const htmlActive = currentSyntax === 'html';
        const isPercentage = mode === 'percentage';

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
    };

    const applySyntaxMode = (syntax) => {
        currentSyntax = syntax;
        const htmlActive = syntax === 'html';

        resizeFieldset.classList.toggle('is-locked', !htmlActive);

        if (!htmlActive) {
            setRowDisabled(percentageRow, true);
            setRowDisabled(absoluteGroup, true);
        } else {
            setRowDisabled(percentageRow, currentResizeMode !== 'percentage');
            setRowDisabled(absoluteGroup, currentResizeMode === 'percentage');
        }

        applyResizeMode(currentResizeMode);
    };

    syntaxRadios.forEach((radio) => {
        if (radio.value === initialSyntax) radio.checked = true;
        radio.addEventListener('change', () => applySyntaxMode(radio.value));
    });

    modeRadios.forEach((radio) => {
        if (radio.value === defaultResizeMode) radio.checked = true;
        radio.addEventListener('change', () => applyResizeMode(radio.value));
    });

    applySyntaxMode(initialSyntax);
    applyResizeMode(defaultResizeMode);
})();
