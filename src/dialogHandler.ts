import joplin from 'api';
import { ImageContext, ResizeDialogResult } from './types';

// We create a fresh dialog each time to ensure updated scripts load (avoids stale cached webview.js in reused dialog).
let dialogHandle: string = null;

export async function showResizeDialog(context: ImageContext): Promise<ResizeDialogResult | null> {
    // Always create a new dialog so we get a clean JS context (fixes issue where updated script didn't re-bind events)
    dialogHandle = await joplin.views.dialogs.create(`imageResizeDialog_${Date.now()}`);
    await joplin.views.dialogs.setFitToContent(dialogHandle, true);

    const originalWidth = context.originalDimensions.width;
    const originalHeight = context.originalDimensions.height;

    // Always update the HTML and scripts before opening
    await joplin.views.dialogs.setHtml(
        dialogHandle,
        `
    <style>
      *,*::before,*::after{box-sizing:border-box}
      body{font-family:system-ui,sans-serif;font-size:14px;margin:0;padding:0;min-width:540px;}
      .container{padding:22px 26px 30px;display:flex;flex-direction:column;gap:18px;width:100%;}
      h4{margin:0 0 10px;font-size:16px}
      form{display:flex;flex-direction:column;gap:22px;width:100%;}
      fieldset{border:1px solid var(--joplin-divider-color,#ccc);border-radius:6px;padding:18px 20px 20px;margin:0;min-width:0;width:100%;}
      legend{font-weight:600}
      .grid{display:grid;grid-template-columns:140px 1fr;gap:10px 18px;align-items:center;width:100%;}
      .grid.narrow{grid-template-columns:max-content 1fr;}
      .stack{display:flex;flex-direction:column;gap:6px}
      .row{display:flex;align-items:center;gap:6px;min-width:0;}
      label{user-select:none}
      input[type=number]{width:92px;padding:4px 6px}
      input[type=text]{width:100%;padding:6px 8px;min-width:0;}
      #preview{font-weight:600;font-variant-numeric:tabular-nums}
      .hint{font-size:11px;opacity:.7;margin-top:4px}
      @media (min-width:860px){body{min-width:600px}.grid{grid-template-columns:160px 1fr}}
    </style>
    <div class="container">
    <div>
      <h4>Resize Image</h4>
      <p style="margin:0 0 4px;">Original: <strong>${originalWidth}px × ${originalHeight}px</strong></p>
    </div>
    <form name="resizeForm" autocomplete="off">
      <fieldset>
        <legend>Resizing</legend>
        <div class="grid">
          <div class="row"><input type="radio" id="modePercent" name="resizeMode" value="percentage" checked><label for="modePercent">By percentage</label></div>
          <div class="row"><input type="number" name="percentage" value="50" min="1" max="500"><span>%</span></div>
          <div class="row"><input type="radio" id="modeAbsolute" name="resizeMode" value="absolute"><label for="modeAbsolute">By absolute size</label></div>
          <div class="stack">
            <div class="row"><label for="absoluteWidth" style="width:55px;">Width</label><input type="number" name="absoluteWidth" id="absoluteWidth" placeholder="Width"><span>px</span></div>
            <div class="row"><label for="absoluteHeight" style="width:55px;">Height</label><input type="number" name="absoluteHeight" id="absoluteHeight" placeholder="Height"><span>px</span></div>
            <div class="hint">Leave one dimension blank to keep aspect ratio.</div>
          </div>
          <label>Preview</label>
          <span id="preview"></span>
        </div>
      </fieldset>
      <fieldset>
        <legend>Output</legend>
        <div class="grid narrow">
          <label for="altText" style="white-space:nowrap;">Alt text</label>
          <div class="row" style="padding:0;min-width:0;"><input type="text" id="altText" name="altText" value="${context.altText}" placeholder="Describe the image"></div>
          <label style="white-space:nowrap;">Syntax</label>
          <div class="stack">
            <label class="row"><input type="radio" name="targetSyntax" value="html" checked> <span>HTML (&lt;img&gt;)</span></label>
            <label class="row"><input type="radio" name="targetSyntax" value="markdown"> <span>Markdown</span></label>
          </div>
        </div>
      </fieldset>
    </form>
    </div>
    <script>
      (function(){
        const form = document.forms.resizeForm; if(!form) return;
        const ow = ${originalWidth}; const oh = ${originalHeight};
        const els = {
          modePercent: form.querySelector('#modePercent'),
          percentage: form.elements.percentage,
          modeAbsolute: form.querySelector('#modeAbsolute'),
          w: form.elements.absoluteWidth,
          h: form.elements.absoluteHeight,
          preview: document.getElementById('preview')
        };
        function updateState(){
          const percent = els.modePercent.checked;
          els.percentage.disabled = !percent;
          els.w.disabled = percent;
          els.h.disabled = percent;
          updatePreview();
        }
        function updatePreview(){
          let w,h;
          if(els.modePercent.checked){
            const pct = parseFloat(els.percentage.value)||0;
            w = Math.round(ow * pct/100); h = Math.round(oh * pct/100);
          } else {
            const iw = parseInt(els.w.value,10);
            const ih = parseInt(els.h.value,10);
            if(iw && !ih){ h = Math.round(iw * (oh/ow)); w = iw; }
            else if(ih && !iw){ w = Math.round(ih * (ow/oh)); h = ih; }
            else { w = iw || ow; h = ih || oh; }
          }
          els.preview.textContent = w + 'px × ' + h + 'px';
        }
        form.addEventListener('input', updatePreview);
        form.addEventListener('change', (e)=>{ if(e.target.name==='resizeMode') updateState(); updatePreview(); });
        updateState();
      })();
    </script>
        `
    );
    const result = await joplin.views.dialogs.open(dialogHandle);

    if (result.id === 'ok' && result.formData) {
        const form = result.formData.resizeForm;
        return {
            targetSyntax: form.targetSyntax,
            altText: form.altText,
            resizeMode: form.resizeMode,
            percentage: form.percentage ? parseInt(form.percentage, 10) : undefined,
            absoluteWidth: form.absoluteWidth ? parseInt(form.absoluteWidth, 10) : undefined,
            absoluteHeight: form.absoluteHeight ? parseInt(form.absoluteHeight, 10) : undefined,
        };
    }

    return null;
}
