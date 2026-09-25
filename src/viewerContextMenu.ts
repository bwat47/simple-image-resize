/**
 * Viewer-origin context menu support.
 *
 * The markdown viewer script posts one message per right-click: the clicked
 * image's `ViewerImageTarget`, or null when the click was not on an annotated
 * resource image. The context menu filter checks that target without moving
 * the editor cursor. The resize command selects the image only when chosen.
 *
 * The message and Joplin's context menu request travel separately, so the
 * filter may run before the message arrives; it waits briefly for it. A
 * message is only used for a menu opened shortly after it arrived, so a
 * right-click that opened no menu can never steer a later one.
 */

import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { isViewerImageTarget, VIEWER_CONTENT_SCRIPT_ID, ViewerImageTarget } from './viewerImageTarget';
import { matchesViewerImageInEditor } from './cursorDetection';
import { logger } from './logger';

/** How long a viewer message stays valid for the context menu it belongs to. */
const VIEWER_MESSAGE_GRACE_MS = 400;

/** How long the context menu filter waits for a viewer message that has not arrived yet. */
const VIEWER_MESSAGE_WAIT_MS = 300;

interface ViewerMessage {
    target: ViewerImageTarget | null;
    receivedAt: number;
}

let latestMessage: ViewerMessage | null = null;
let notifyMessageArrived: (() => void) | null = null;

/** Record a message from the viewer script. Exported for tests. */
export function receiveViewerMessage(message: unknown): void {
    latestMessage = {
        target: isViewerImageTarget(message) ? message : null,
        receivedAt: Date.now(),
    };
    notifyMessageArrived?.();
}

const isFresh = (message: ViewerMessage | null): message is ViewerMessage =>
    message !== null && Date.now() - message.receivedAt <= VIEWER_MESSAGE_GRACE_MS;

function waitForMessage(): Promise<void> {
    return new Promise((resolve) => {
        const done = (): void => {
            clearTimeout(timer);
            notifyMessageArrived = null;
            resolve();
        };
        const timer = setTimeout(done, VIEWER_MESSAGE_WAIT_MS);
        notifyMessageArrived = done;
    });
}

/**
 * Take the viewer message for the context menu being built, waiting briefly if
 * it has not arrived. Consumes the message so it applies to one menu only.
 */
async function takeViewerTarget(): Promise<ViewerImageTarget | null> {
    if (!isFresh(latestMessage)) {
        await waitForMessage();
    }

    const message = latestMessage;
    latestMessage = null;
    return isFresh(message) ? message.target : null;
}

/**
 * Match a viewer image without changing the editor selection. The menu item
 * carries this target as a command argument for revalidation when chosen.
 */
export async function getViewerContextMenuImage(): Promise<ViewerImageTarget | null> {
    const target = await takeViewerTarget();
    if (!target) {
        return null;
    }

    const matched = await matchesViewerImageInEditor(target);
    logger.debug('Viewer context menu target', target, matched ? 'matched in editor' : 'not matched in editor');
    return matched ? target : null;
}

export async function registerViewerContentScript(): Promise<void> {
    await joplin.contentScripts.register(
        ContentScriptType.MarkdownItPlugin,
        VIEWER_CONTENT_SCRIPT_ID,
        './contentScripts/viewerContentScript.js'
    );

    await joplin.contentScripts.onMessage(VIEWER_CONTENT_SCRIPT_ID, receiveViewerMessage);
}
