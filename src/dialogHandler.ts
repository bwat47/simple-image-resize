import joplin from 'api';
import { ImageContext, ResizeDialogResult } from './types';

// We create a fresh dialog each time (script now inlined so this is mostly to ensure clean state per open).
let dialogHandle: string = null;

export async function showResizeDialog(
    context: ImageContext,
    defaultResizeMode: 'percentage' | 'absolute' = 'percentage'
): Promise<ResizeDialogResult | null> {
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
      *, *::before, *::after { box-sizing: border-box }
      body { 
        font-family: system-ui, sans-serif; 
        font-size: 14px; 
        margin: 0; 
        padding: 0; 
        min-width: 620px;
      }
      .container { 
        padding: 22px 26px 30px; 
        display: flex; 
        flex-direction: column; 
        gap: 18px; 
        width: 100%;
      }
      h4 { margin: 0 0 10px; font-size: 16px }
      form { display: flex; flex-direction: column; gap: 22px; width: 100%; }
      fieldset { 
        border: 1px solid var(--joplin-divider-color, #ccc); 
        border-radius: 6px; 
        padding: 18px 20px 20px; 
        margin: 0; 
        min-width: 0; 
        width: 100%;
        transition: opacity 0.2s ease, background-color 0.2s ease;
      }
      legend { font-weight: 600 }
      .grid { 
        display: grid; 
        grid-template-columns: 140px 1fr; 
        gap: 10px 18px; 
        align-items: center; 
        width: 100%;
      }
      .grid.narrow { grid-template-columns: max-content 1fr; }
      .stack { display: flex; flex-direction: column; gap: 6px }
      .row { display: flex; align-items: center; gap: 6px; min-width: 0; }
      label { user-select: none; cursor: pointer; }
      input[type=number] { 
        width: 92px; 
        padding: 4px 6px;
        transition: background-color 0.2s ease, opacity 0.2s ease;
      }
      input[type=text] { 
        width: 100%; 
        padding: 6px 8px; 
        min-width: 0;
        transition: background-color 0.2s ease;
      }
      input[type=radio] { cursor: pointer; }
      .hint { 
        font-size: 11px; 
        opacity: 0.7; 
        margin-top: 4px;
        transition: opacity 0.2s ease;
      }
      
      /* Code examples styling */
      code {
        background-color: #f5f5f5;
        padding: 2px 4px;
        border-radius: 3px;
        font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
        font-size: 10px;
      }
      
      /* CSS-only field disabling based on radio button states */
      
      /* Conditional default state based on user preference */
      ${
          defaultResizeMode === 'percentage'
              ? `
      .absolute-size-row {
        opacity: 0.4;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .absolute-size-row input {
        background-color: #f8f8f8;
        cursor: not-allowed;
      }
      .absolute-size-row .hint {
        opacity: 0.4;
      }
      `
              : `
      .percentage-row {
        opacity: 0.4;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }
      .percentage-row input {
        background-color: #f8f8f8;
        cursor: not-allowed;
      }
      `
      }
      
      /* When percentage mode is checked, enable percentage field and disable absolute */
      #modePercent:checked ~ .resize-fieldset .percentage-row {
        opacity: 1;
        pointer-events: auto;
      }
      #modePercent:checked ~ .resize-fieldset .percentage-row input {
        background-color: white;
        cursor: text;
      }
      #modePercent:checked ~ .resize-fieldset .absolute-size-row {
        opacity: 0.4;
        pointer-events: none;
      }
      #modePercent:checked ~ .resize-fieldset .absolute-size-row input {
        background-color: #f8f8f8;
        cursor: not-allowed;
      }
      #modePercent:checked ~ .resize-fieldset .absolute-size-row .hint {
        opacity: 0.4;
      }
      
      /* When absolute mode is checked, enable absolute fields and disable percentage */
      #modeAbsolute:checked ~ .resize-fieldset .absolute-size-row {
        opacity: 1;
        pointer-events: auto;
      }
      #modeAbsolute:checked ~ .resize-fieldset .absolute-size-row input {
        background-color: white;
        cursor: text;
      }
      #modeAbsolute:checked ~ .resize-fieldset .absolute-size-row .hint {
        opacity: 0.7;
      }
      #modeAbsolute:checked ~ .resize-fieldset .percentage-row {
        opacity: 0.4;
        pointer-events: none;
      }
      #modeAbsolute:checked ~ .resize-fieldset .percentage-row input {
        background-color: #f8f8f8;
        cursor: not-allowed;
      }
      
      /* When markdown syntax is selected, disable entire resize fieldset */
      #syntaxMarkdown:checked ~ form .resize-fieldset {
        opacity: 0.4;
        pointer-events: none;
        background-color: #fafafa;
      }
      #syntaxMarkdown:checked ~ form .resize-fieldset input {
        background-color: #f0f0f0;
        cursor: not-allowed;
      }
      #syntaxMarkdown:checked ~ form .resize-fieldset .hint {
        opacity: 0.3;
      }
      
      /* Responsive improvements */
      @media (max-width: 700px) {
        body { min-width: 480px; }
        .grid { grid-template-columns: 120px 1fr; gap: 8px 12px; }
        .container { padding: 16px 20px 24px; gap: 14px; }
        code { font-size: 9px; }
      }
      
      @media (min-width: 860px) {
        body { min-width: 680px }
        .grid { grid-template-columns: 160px 1fr }
      }
    </style>
    <div class="container">
    <div>
      <h4>Resize Image</h4>
      <p style="margin:0 0 4px;">Original: <strong>${originalWidth}px × ${originalHeight}px</strong></p>
    </div>
    <!-- Place controlling radio buttons at the top level for CSS sibling selectors -->
    <input type="radio" id="syntaxHtml" name="cssTargetSyntax" value="html" checked style="position:absolute;left:-9999px;">
    <input type="radio" id="syntaxMarkdown" name="cssTargetSyntax" value="markdown" style="position:absolute;left:-9999px;">
    
    <form name="resizeForm" autocomplete="off">
      <fieldset>
        <legend>Output</legend>
        <div class="grid narrow">
          <label for="altText" style="white-space:nowrap;">Alt text</label>
          <div class="row" style="padding:0;min-width:0;">
            <input type="text" id="altText" name="altText" value="${context.altText}" placeholder="Describe the image">
          </div>
          <label style="white-space:nowrap;">Syntax</label>
          <div class="stack">
            <label class="row">
              <input type="radio" name="targetSyntax" value="html" checked onchange="document.getElementById('syntaxHtml').checked=true"> 
              <span style="display:flex;flex-direction:column;gap:2px;">
                <span>HTML (supports resizing)</span>
                <code style="font-size:11px;opacity:0.7;">&lt;img src=":/resourceId" alt="alt" width="300" height="200" /&gt;</code>
              </span>
            </label>
            <label class="row">
              <input type="radio" name="targetSyntax" value="markdown" onchange="document.getElementById('syntaxMarkdown').checked=true"> 
              <span style="display:flex;flex-direction:column;gap:2px;">
                <span>Markdown (original size only)</span>
                <code style="font-size:11px;opacity:0.7;">![alt](:/resourceId)</code>
              </span>
            </label>
            <div class="hint" style="margin-top:8px;">Note: Resize settings are only available when HTML Syntax is selected. Select Markdown if you want to return to original markdown syntax with no custom size.</div>
          </div>
        </div>
      </fieldset>
      
      <!-- Place controlling radio buttons before the fieldset they control -->
      <input type="radio" id="modePercent" name="cssResizeMode" value="percentage" ${defaultResizeMode === 'percentage' ? 'checked' : ''} style="position:absolute;left:-9999px;">
      <input type="radio" id="modeAbsolute" name="cssResizeMode" value="absolute" ${defaultResizeMode === 'absolute' ? 'checked' : ''} style="position:absolute;left:-9999px;">
      
      <fieldset class="resize-fieldset">
        <legend>Resizing</legend>
        <div class="grid">
          <div class="row">
            <input type="radio" name="resizeMode" value="percentage" ${defaultResizeMode === 'percentage' ? 'checked' : ''} onchange="document.getElementById('modePercent').checked=true">
            <label>Percentage</label>
          </div>
          <div class="row percentage-row">
            <input type="number" name="percentage" value="50" min="1" max="500">
            <span>%</span>
          </div>
          <div class="row">
            <input type="radio" name="resizeMode" value="absolute" ${defaultResizeMode === 'absolute' ? 'checked' : ''} onchange="document.getElementById('modeAbsolute').checked=true">
            <label>Absolute size</label>
          </div>
          <div class="stack absolute-size-row">
            <div class="row">
              <label for="absoluteWidth" style="width:55px;">Width</label>
              <input type="number" name="absoluteWidth" id="absoluteWidth" placeholder="Width">
              <span>px</span>
            </div>
            <div class="row">
              <label for="absoluteHeight" style="width:55px;">Height</label>
              <input type="number" name="absoluteHeight" id="absoluteHeight" placeholder="Height">
              <span>px</span>
            </div>
            <div class="hint">Leave one dimension blank to keep aspect ratio.</div>
          </div>
        </div>
      </fieldset>
    </form>
    </div>
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
