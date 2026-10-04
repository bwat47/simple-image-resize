/** Types for local access to Joplin's viewer environment; no global declarations. */
import type { ViewerImageTarget } from '../viewerImageTarget';

export type ViewerWindow = Window & {
    simpleImageResizeViewerContextMenuLoaded?: boolean;
};

/** Message posted by the viewer asset on every right-click. */
export type ViewerContextMenuMessage = {
    target: ViewerImageTarget | null;
    clickedAt: number;
};

export type ViewerWebviewApi = {
    postMessage(contentScriptId: string, message: ViewerContextMenuMessage): Promise<unknown>;
};
