/**
 * Viewer-origin context menu support.
 *
 * The markdown viewer script posts one message per right-click with the click
 * time and the image's `ViewerImageTarget`, or a null target when the click was
 * not on an annotated resource image. The context menu filter checks that
 * target without moving the editor cursor. The resize command selects the
 * image only when chosen.
 *
 * The message and Joplin's context menu request travel separately. The click
 * timestamp lets the filter reject a delayed message after its menu timed out,
 * while still accepting messages that arrived before the filter started.
 */

import joplin from 'api';
import { ContentScriptType } from 'api/types';
import { isViewerImageTarget, VIEWER_CONTENT_SCRIPT_ID, ViewerImageTarget } from './viewerImageTarget';
import { matchesViewerImageInEditor } from './cursorDetection';
import { logger } from './logger';

/** Maximum time between a viewer click and the start of its menu request. */
const VIEWER_MESSAGE_GRACE_MS = 400;

/** How long the context menu filter waits for a viewer message that has not arrived yet. */
const VIEWER_MESSAGE_WAIT_MS = 300;

interface ViewerMessage {
    target: ViewerImageTarget | null;
    clickedAt: number;
}

let latestMessage: ViewerMessage | null = null;
let discardedThrough = -Infinity;
const messageWaiters = new Set<() => void>();

/** Record a message from the viewer script. Exported for tests. */
export function receiveViewerMessage(message: unknown): void {
    if (typeof message !== 'object' || message === null) return;

    const candidate = message as Partial<ViewerMessage>;
    if (typeof candidate.clickedAt !== 'number' || !Number.isFinite(candidate.clickedAt)) return;
    if (candidate.clickedAt <= discardedThrough || candidate.clickedAt > Date.now()) return;
    if (latestMessage && candidate.clickedAt <= latestMessage.clickedAt) return;

    latestMessage = {
        target: isViewerImageTarget(candidate.target) ? candidate.target : null,
        clickedAt: candidate.clickedAt,
    };
    for (const notify of messageWaiters) notify();
}

/**
 * Drop clicks at or before `throughTime`, including messages still in transit.
 * Callers pass the menu's start time, so a click during that menu's awaits stays valid.
 */
export function discardViewerMessagesThrough(throughTime: number): void {
    discardedThrough = Math.max(discardedThrough, throughTime);
    if (latestMessage && latestMessage.clickedAt <= discardedThrough) latestMessage = null;
}

const belongsToRequest = (message: ViewerMessage | null, requestStartedAt: number): message is ViewerMessage =>
    message !== null &&
    message.clickedAt > discardedThrough &&
    message.clickedAt >= requestStartedAt - VIEWER_MESSAGE_GRACE_MS &&
    message.clickedAt <= requestStartedAt;

function waitForMessage(requestStartedAt: number): Promise<void> {
    return new Promise((resolve) => {
        const done = (): void => {
            clearTimeout(timer);
            messageWaiters.delete(done);
            resolve();
        };
        const timer = setTimeout(() => {
            discardViewerMessagesThrough(requestStartedAt);
            done();
        }, VIEWER_MESSAGE_WAIT_MS);
        messageWaiters.add(done);
    });
}

/**
 * Take the viewer message for the context menu being built, waiting briefly if
 * it has not arrived. Consumes the message so it applies to one menu only.
 */
async function takeViewerTarget(requestStartedAt: number): Promise<ViewerImageTarget | null> {
    if (!belongsToRequest(latestMessage, requestStartedAt)) {
        await waitForMessage(requestStartedAt);
    }

    const message = latestMessage;
    if (!belongsToRequest(message, requestStartedAt)) return null;

    latestMessage = null;
    discardedThrough = Math.max(discardedThrough, message.clickedAt);
    return message.target;
}

/**
 * Match a viewer image without changing the editor selection. The menu item
 * carries this target as a command argument for revalidation when chosen.
 */
export async function getViewerContextMenuImage(requestStartedAt: number): Promise<ViewerImageTarget | null> {
    const target = await takeViewerTarget(requestStartedAt);
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
