// @vitest-environment jsdom

import { revealWhenSized } from '../src/dialog/revealWhenSized';

function createRoot(bottom: number): HTMLElement {
    const root = document.createElement('div');
    root.getBoundingClientRect = () => ({ bottom }) as DOMRect;
    document.body.appendChild(root);
    return root;
}

function setViewportHeight(height: number): void {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

describe('revealWhenSized', () => {
    afterEach(() => {
        document.body.replaceChildren();
    });

    it('reveals immediately when the viewport already fits the content', () => {
        setViewportHeight(420);
        const root = createRoot(400);

        revealWhenSized(root);

        expect(root.classList.contains('is-sized')).toBe(true);
    });

    it('waits for the viewport to shrink to the content before revealing', () => {
        setViewportHeight(900);
        const root = createRoot(400);

        revealWhenSized(root);
        expect(root.classList.contains('is-sized')).toBe(false);

        setViewportHeight(420);
        window.dispatchEvent(new Event('resize'));
        expect(root.classList.contains('is-sized')).toBe(true);
    });
});
