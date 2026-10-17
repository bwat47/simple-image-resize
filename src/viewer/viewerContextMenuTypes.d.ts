/** Types for local access to Joplin's viewer environment; no global declarations. */
import type { ViewerContextMenuMessage } from '../shared/viewerImageTarget';

export type ViewerWindow = Window & {
    simpleImageResizeViewerContextMenuLoaded?: boolean;
};

export type ViewerWebviewApi = {
    postMessage(contentScriptId: string, message: ViewerContextMenuMessage): Promise<unknown>;
};
