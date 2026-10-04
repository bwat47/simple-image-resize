/** Globals provided by Joplin or owned by the plain-script viewer asset. */
interface Window {
    simpleImageResizeViewerContextMenuLoaded?: boolean;
}

interface ViewerWebviewApi {
    postMessage(contentScriptId: string, message: unknown): Promise<unknown>;
}

declare const webviewApi: ViewerWebviewApi;
