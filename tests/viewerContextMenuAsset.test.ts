// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import MarkdownIt from 'markdown-it';
import { installImagePositions } from '../src/contentScripts/viewerContentScript';
import { VIEWER_CONTENT_SCRIPT_ID } from '../src/viewerImageTarget';

const script = readFileSync(resolve(process.cwd(), 'src/contentScripts/viewerContextMenu.js'), 'utf8');
const resourceId = '0123456789abcdef0123456789abcdef';

it('reports positions stamped by the viewer renderer to the registered content script', () => {
    const markdownIt = new MarkdownIt();
    installImagePositions(markdownIt, { mapsToLine: true });
    const html = markdownIt.render(`Before\n\n![first](:/${resourceId}) ![second](:/${resourceId})`);
    document.body.innerHTML = html;
    const messages: { id: string; message: unknown }[] = [];
    const images = document.querySelectorAll('img');
    images.forEach((image) => image.setAttribute('data-resource-id', resourceId));
    Object.assign(window, {
        webviewApi: {
            postMessage: (id: string, message: unknown): Promise<void> => {
                messages.push({ id, message });
                return Promise.resolve();
            },
        },
    });

    window.eval(script);
    images[1].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    expect(messages).toEqual([
        {
            id: VIEWER_CONTENT_SCRIPT_ID,
            message: {
                target: { line: 2, lineEnd: 3, index: 1, resourceId },
                clickedAt: expect.any(Number),
            },
        },
    ]);
});
