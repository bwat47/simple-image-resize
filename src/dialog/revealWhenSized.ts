/**
 * Reveals the dialog once its webview has shrunk to fit the content.
 *
 * Joplin mobile first lays the dialog out at nearly full-screen size (at low opacity)
 * and only shrinks it after measuring the content, so the content stays transparent
 * (see `.is-sized` in resizeDialogStyles.ts) until the viewport roughly matches it.
 * Opacity is used instead of visibility so the focused field stays focusable.
 * The stylesheet also reveals the content after a delay in case this never fires.
 */

/** Leftover viewport space allowed below the root (covers Joplin's wrapper padding). */
const FIT_TOLERANCE_PX = 48;

export function revealWhenSized(root: HTMLElement): void {
    const reveal = (): boolean => {
        const emptySpace = window.innerHeight - root.getBoundingClientRect().bottom;
        if (emptySpace > FIT_TOLERANCE_PX) return false;
        root.classList.add('is-sized');
        return true;
    };

    if (reveal()) return;

    const onResize = (): void => {
        if (reveal()) window.removeEventListener('resize', onResize);
    };
    window.addEventListener('resize', onResize);
}
