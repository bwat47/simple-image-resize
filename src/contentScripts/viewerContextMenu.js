/**
 * Markdown viewer asset: reports right-clicked images to the plugin.
 *
 * Loaded as a plain script by viewerContentScript.ts, so it cannot import
 * shared modules. The content script ID and attribute names below must match
 * src/viewerImageTarget.ts.
 *
 * Every right-click in the viewer posts a message, with `null` when the target
 * is not an annotated resource image. That gives the context menu filter a
 * definitive answer for each right-click instead of waiting for a timeout.
 * Only resource images qualify, because the viewer opens a context menu for an
 * image only when it has a `data-resource-id`.
 */
(function () {
    if (window.simpleImageResizeViewerContextMenuLoaded) return;
    window.simpleImageResizeViewerContextMenuLoaded = true;

    const CONTENT_SCRIPT_ID = 'simpleImageResize-viewerContentScript';

    const readIndex = (element, name) => {
        const value = element.getAttribute(name);
        return value !== null && /^\d+$/.test(value) ? Number(value) : null;
    };

    const findTarget = (eventTarget) => {
        const image = eventTarget instanceof Element ? eventTarget.closest('img') : null;
        if (!image) return null;

        const resourceId = image.getAttribute('data-resource-id');
        const line = readIndex(image, 'data-image-resize-line');
        const lineEnd = readIndex(image, 'data-image-resize-line-end');
        const index = readIndex(image, 'data-image-resize-index');
        if (!resourceId || line === null || lineEnd === null || index === null) return null;

        return { line, lineEnd, index, resourceId };
    };

    // Capture phase, so the message is sent before Joplin's own viewer
    // handler asks the app to open its context menu.
    document.addEventListener(
        'contextmenu',
        (event) => {
            webviewApi.postMessage(CONTENT_SCRIPT_ID, findTarget(event.target)).catch((error) => {
                console.warn('[Image Resize] Could not report viewer context menu target:', error);
            });
        },
        true
    );
})();
