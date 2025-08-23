(() => {
    const VERSION = 'webview-v3';
    function init() {
        const form = document.forms.resizeForm;
        if (!form) return; // Shouldn't happen
        const aspectRatio = originalWidth / originalHeight;
        console.log('[image-resize]', VERSION, 'init start');

        // Radios share the name "resizeMode" so we must select them by ID, not via form.elements.<id>
        const elements = {
            modePercent: document.getElementById('modePercent'),
            modeAbsolute: document.getElementById('modeAbsolute'),
            percentage: form.elements.percentage,
            absoluteWidth: form.elements.absoluteWidth,
            absoluteHeight: form.elements.absoluteHeight,
            maintainAspectRatio: form.elements.maintainAspectRatio,
            preview: document.getElementById('preview'),
        };

        let syncing = false; // prevent infinite loops when updating paired dimension

        function updateFormState() {
            const percentMode = elements.modePercent.checked;

            // Percentage input active only in percent mode
            elements.percentage.readOnly = !percentMode;
            elements.percentage.classList.toggle('inactive-input', !percentMode);

            // Absolute inputs active only in absolute mode
            const absActive = !percentMode;
            for (const el of [elements.absoluteWidth, elements.absoluteHeight]) {
                el.readOnly = !absActive;
                el.classList.toggle('inactive-input', !absActive);
            }

            if (absActive) {
                if (!elements.absoluteWidth.value && !elements.absoluteHeight.value) {
                    const percent = parseFloat(elements.percentage.value) || 100;
                    elements.absoluteWidth.value = Math.round(originalWidth * (percent / 100));
                    elements.absoluteHeight.value = Math.round(originalHeight * (percent / 100));
                }
                // Initialize counterpart height based on width to ensure aspect ratio consistency
                handleAspectRatio('width');
                // Give user immediate edit focus
                setTimeout(() => elements.absoluteWidth.focus(), 0);
            }
        }

        function updatePreview() {
            let newWidth, newHeight;

            if (elements.modePercent.checked) {
                const percent = parseFloat(elements.percentage.value) || 0;
                newWidth = Math.round(originalWidth * (percent / 100));
                newHeight = Math.round(originalHeight * (percent / 100));
            } else {
                newWidth = parseInt(elements.absoluteWidth.value, 10) || 0;
                newHeight = parseInt(elements.absoluteHeight.value, 10) || 0;
            }

            elements.preview.textContent = `${newWidth}px × ${newHeight}px`;
        }

        function handleAspectRatio(changedInput) {
            if (!elements.maintainAspectRatio.checked) return;
            // Only adjust when absolute mode is active
            if (elements.modePercent.checked) return;

            const w = parseInt(elements.absoluteWidth.value, 10);
            const h = parseInt(elements.absoluteHeight.value, 10);

            if (syncing) return;
            syncing = true;
            if (changedInput === 'width' && w > 0) {
                elements.absoluteHeight.value = Math.round(w / aspectRatio) || '';
            } else if (changedInput === 'height' && h > 0) {
                elements.absoluteWidth.value = Math.round(h * aspectRatio) || '';
            }
            syncing = false;
        }

        // When any form element changes, update the state and the preview.
        form.addEventListener('change', () => {
            updateFormState();
            updatePreview();
        });

        form.addEventListener('input', (event) => {
            console.log('[resize] input', event.target.name, 'percentMode?', elements.modePercent.checked);
            if (event.target.name === 'absoluteWidth') {
                handleAspectRatio('width');
            }
            if (event.target.name === 'absoluteHeight') {
                handleAspectRatio('height');
            }
            updatePreview();
        });

        // Direct listeners for robustness (some environments may not bubble as expected)
        elements.absoluteWidth.addEventListener('keyup', () => {
            handleAspectRatio('width');
            updatePreview();
        });
        elements.absoluteHeight.addEventListener('keyup', () => {
            handleAspectRatio('height');
            updatePreview();
        });
        // Additional events to catch mouse wheel, blur, etc.
        ['change', 'blur', 'wheel'].forEach((evt) => {
            elements.absoluteWidth.addEventListener(evt, () => {
                handleAspectRatio('width');
                updatePreview();
            });
            elements.absoluteHeight.addEventListener(evt, () => {
                handleAspectRatio('height');
                updatePreview();
            });
        });

        // Initial setup
        updateFormState();
        updatePreview();
        console.log('[image-resize]', VERSION, 'init complete');
    }
    // Expose for potential inline fallback
    window.__imgResizeSync = (t) => handleAspectRatio(t);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
    // Fallback: poll once per 300ms up to 5 times to ensure listeners attached
    let tries = 0;
    const interval = setInterval(() => {
        tries++;
        const form = document.forms.resizeForm;
        if (form) {
            if (tries === 1) console.log('[image-resize]', VERSION, 'poll attach check ok');
            if (tries >= 5) clearInterval(interval);
        } else if (tries >= 5) {
            clearInterval(interval);
            console.warn('[image-resize]', VERSION, 'form not found after polling');
        }
    }, 300);
})();
