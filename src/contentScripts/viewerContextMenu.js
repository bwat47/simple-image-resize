// @ts-check
/**
 * Markdown viewer asset: reports right-clicked images to the plugin.
 *
 * Loaded as a plain script by viewerContentScript.ts, so it cannot import
 * shared modules (JSDoc type imports are erased). The content script ID and attribute names below must match
 * src/viewerImageTarget.ts.
 *
 * Every right-click in the viewer posts its click time and image target, with
 * a null target when the click is not on an annotated resource image. That
 * gives the context menu filter a definitive answer for each right-click.
 * Only resource images qualify, because the viewer opens a context menu for an
 * image only when it has a `data-resource-id`.
 */
(function () {
    const viewerWindow = /** @type {import('./viewerContextMenuTypes').ViewerWindow} */ (window);
    if (viewerWindow.simpleImageResizeViewerContextMenuLoaded) return;
    viewerWindow.simpleImageResizeViewerContextMenuLoaded = true;

    const CONTENT_SCRIPT_ID = 'simpleImageResize-viewerContentScript';

    /** Joplin injects `webviewApi` as a lexical global only in the viewer runtime. */
    const getViewerApi = () => {
        /** @type {unknown} */
        const hostApi =
            // @ts-expect-error Not declared globally, so plugin-side code cannot use it by mistake.
            webviewApi;
        return /** @type {import('./viewerContextMenuTypes').ViewerWebviewApi} */ (hostApi);
    };

    /** @param {Element} element @param {string} name */
    const readIndex = (element, name) => {
        const value = element.getAttribute(name);
        return value !== null && /^\d+$/.test(value) ? Number(value) : null;
    };

    /** @param {EventTarget | null} eventTarget */
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
            getViewerApi()
                .postMessage(CONTENT_SCRIPT_ID, { target: findTarget(event.target), clickedAt: Date.now() })
                .catch((error) => {
                    console.warn('[Image Resize] Could not report viewer context menu target:', error);
                });
        },
        true
    );
})();
