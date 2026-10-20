/**
 * Resize dialog stylesheet, embedded in the dialog markup so it arrives with the HTML.
 * Loading it via addScript instead lets the dialog render unstyled first, which shows up
 * as a visible layout adjustment after the dialog opens on Joplin mobile.
 *
 * The `css` tag lets Prettier format the template as CSS; String.raw keeps CSS escapes intact.
 */
const css = String.raw;

export const resizeDialogCss = css`
    *,
    *::before,
    *::after {
        box-sizing: border-box;
    }
    body {
        font-family: system-ui, sans-serif;
        font-size: 14px;
        margin: 0;
        padding: 0;
        min-width: 380px;
        background-color: var(--joplin-background-color, transparent);
        color: var(--joplin-color, #32373f);
    }
    /* Joplin mobile sizes the dialog to this wrapper's measured width, which otherwise
       fills the whole window on wide screens (e.g. the web app). */
    #joplin-plugin-content {
        max-width: 440px;
    }
    /* Hidden until revealWhenSized confirms Joplin has shrunk the webview to fit.
       The animation is a fail-safe that reveals the content anyway after a second. */
    #dialog-root {
        opacity: 0;
        animation: dialog-reveal 0s 1s forwards;
    }
    #dialog-root.is-sized {
        opacity: 1;
        animation: none;
    }
    @keyframes dialog-reveal {
        to {
            opacity: 1;
        }
    }
    .container {
        padding: 16px 20px 24px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
    }
    h4 {
        margin: 0 0 10px;
        font-size: 16px;
    }
    form {
        display: flex;
        flex-direction: column;
        gap: 22px;
        width: 100%;
    }
    fieldset {
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 6px;
        padding: 18px 20px 20px;
        margin: 0;
        min-width: 0;
        width: 100%;
        transition:
            opacity 0.2s ease,
            background-color 0.2s ease;
    }
    legend {
        font-weight: 600;
    }
    .grid {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 8px 12px;
        align-items: center;
        width: 100%;
    }
    .grid.narrow {
        grid-template-columns: max-content 1fr;
    }
    .stack {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }
    label {
        user-select: none;
        cursor: pointer;
    }
    input[type='number'] {
        width: 92px;
        padding: 4px 6px;
        background-color: var(--joplin-background-color, transparent);
        color: var(--joplin-color, #32373f);
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 3px;
        transition: background-color 0.2s ease;
        outline: none;
    }
    input[type='text'] {
        width: 100%;
        padding: 6px 8px;
        min-width: 0;
        background-color: var(--joplin-background-color, transparent);
        color: var(--joplin-color, #32373f);
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 3px;
        outline: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    input[type='radio'] {
        appearance: none;
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        border: 2px solid var(--joplin-divider-color, #dddddd);
        border-radius: 50%;
        background-color: var(--joplin-background-color, transparent);
        cursor: pointer;
        position: relative;
        transition: all 0.15s ease;
        flex-shrink: 0;
    }

    input[type='radio']:hover:not(:disabled) {
        border-color: var(--joplin-color4, #2d6bdc);
        background-color: var(--joplin-background-color-hover4, rgba(203, 218, 241, 0.3));
    }

    input[type='radio']:checked {
        border-color: var(--joplin-color4, #2d6bdc);
    }

    input[type='radio']:checked::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: var(--joplin-color4, #2d6bdc);
    }

    input[type='radio']:disabled {
        cursor: not-allowed;
        opacity: 0.4;
        border-color: var(--joplin-divider-color, #dddddd);
    }

    input[type='radio']:focus-visible {
        outline: 2px solid var(--joplin-focus-outline-color, rgb(228, 86, 0));
        outline-offset: 2px;
    }
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    .row.is-disabled,
    .stack.is-disabled {
        opacity: 0.6;
    }
    .row.is-disabled input,
    .stack.is-disabled input {
        background-color: var(--joplin-raised-background-color, #e5e5e5);
        cursor: not-allowed;
    }
    .resize-fieldset.is-locked {
        opacity: 0.4;
        pointer-events: none;
        background-color: var(--joplin-background-color3, #f4f5f6);
    }

    /* Utility classes for repeated patterns */
    .label-nowrap {
        white-space: nowrap;
    }
    .label-fixed {
        width: 55px;
    }
`;
