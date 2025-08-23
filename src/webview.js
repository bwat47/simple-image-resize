document.addEventListener('DOMContentLoaded', () => {
  // Note: originalWidth and originalHeight are defined globally in the HTML script tag
  const form = document.forms.resizeForm;
  const aspectRatio = originalWidth / originalHeight;

  const elements = {
    modePercent: form.elements.modePercent,
    modeAbsolute: form.elements.modeAbsolute,
    percentage: form.elements.percentage,
    absoluteWidth: form.elements.absoluteWidth,
    absoluteHeight: form.elements.absoluteHeight,
    maintainAspectRatio: form.elements.maintainAspectRatio,
    preview: document.getElementById('preview'),
  };

  function updateFormState() {
    if (elements.modePercent.checked) {
      elements.percentage.disabled = false;
      elements.absoluteWidth.disabled = true;
      elements.absoluteHeight.disabled = true;
    } else {
      elements.percentage.disabled = true;
      elements.absoluteWidth.disabled = false;
      elements.absoluteHeight.disabled = false;
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

    const w = parseInt(elements.absoluteWidth.value, 10);
    const h = parseInt(elements.absoluteHeight.value, 10);

    if (changedInput === 'width' && w > 0) {
      elements.absoluteHeight.value = Math.round(w / aspectRatio);
    } else if (changedInput === 'height' && h > 0) {
      elements.absoluteWidth.value = Math.round(h * aspectRatio);
    }
  }

  form.addEventListener('change', (event) => {
    if (event.target.name === 'resizeMode') {
      updateFormState();
    }
    updatePreview();
  });

  form.addEventListener('input', (event) => {
    if (event.target.name === 'absoluteWidth') {
      handleAspectRatio('width');
    }
    if (event.target.name === 'absoluteHeight') {
      handleAspectRatio('height');
    }
    updatePreview();
  });

  // Initial setup
  updateFormState();
  updatePreview();
});
