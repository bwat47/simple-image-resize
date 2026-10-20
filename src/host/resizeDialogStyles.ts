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
        min-width: 320px;
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
        padding: 16px 14px 24px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        width: 100%;
    }
    h4 {
        margin: 0 0 10px;
        font-size: 16px;
    }
    .grid {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 8px 12px;
        align-items: center;
        width: 100%;
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
        width: 80px;
        padding: 4px 6px;
        background-color: var(--joplin-background-color, transparent);
        color: var(--joplin-color, #32373f);
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 3px;
        transition: background-color 0.2s ease;
    }
    input[type='text'] {
        width: 100%;
        padding: 6px 8px;
        min-width: 0;
        background-color: var(--joplin-background-color, transparent);
        color: var(--joplin-color, #32373f);
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    /* Pull the ring inward so it sits on top of the 1px border rather than around it. */
    input[type='number']:focus-visible,
    input[type='text']:focus-visible {
        outline: 2px solid var(--joplin-focus-outline-color, rgb(228, 86, 0));
        outline-offset: -1px;
    }
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Segmented toggle: each segment is a label wrapping a visually hidden native radio,
       so keyboard navigation, form values and change events work as with plain radios. */
    .segmented {
        display: inline-flex;
        justify-self: start;
        align-self: flex-start;
        border: 1px solid var(--joplin-divider-color, #dddddd);
        border-radius: 4px;
        overflow: hidden;
    }
    .segment {
        position: relative;
        display: flex;
    }
    .segment + .segment {
        border-left: 1px solid var(--joplin-divider-color, #dddddd);
    }
    .segment input {
        position: absolute;
        inset: 0;
        margin: 0;
        opacity: 0;
        pointer-events: none;
    }
    .segment span {
        padding: 4px 12px;
        white-space: nowrap;
        transition: background-color 0.15s ease;
    }
    .segment input:not(:checked):not(:disabled) + span:hover {
        background-color: var(--joplin-background-color-hover4, rgba(203, 218, 241, 0.3));
    }
    .segment input:checked + span {
        background-color: var(--joplin-raised-background-color, #e5e5e5);
        color: var(--joplin-color4, #2d6bdc);
    }
    /* Inset, because the group's overflow: hidden clips anything drawn outside a segment. */
    .segment input:focus-visible + span {
        outline: 2px solid var(--joplin-focus-outline-color, rgb(228, 86, 0));
        outline-offset: -2px;
    }
    .segment.is-disabled {
        cursor: not-allowed;
    }
    /* Sits in the control column under the control it annotates, tucked closer than a normal row. */
    .hint {
        grid-column: 2;
        margin: -4px 0 0;
        font-size: 12px;
        color: var(--joplin-color-faded, #7c8b9e);
    }

    /* A label + control pair that toggles as one unit, while staying aligned to the
       parent grid's columns. */
    .subgrid {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: subgrid;
        row-gap: 8px;
        align-items: center;
    }
    /* Both mode panels share one cell and only the active one is visible, so the
       dialog keeps the same height (and Joplin doesn't refit it) when the mode changes. */
    .mode-panels > * {
        grid-row: 1;
        align-self: start;
    }
    .resize-section:has(input[name='resizeMode'][value='absolute']:checked) [data-percentage-row],
    .resize-section:has(input[name='resizeMode'][value='percentage']:checked) [data-absolute-group] {
        visibility: hidden;
    }

    .is-disabled {
        opacity: 0.6;
    }
    .is-disabled input[type='number'] {
        background-color: var(--joplin-raised-background-color, #e5e5e5);
        cursor: not-allowed;
    }
    /* Extra space separates the output options from the sizing options. */
    .resize-section {
        margin-top: 8px;
        transition: opacity 0.2s ease;
    }
    .resize-section.is-locked {
        opacity: 0.4;
        pointer-events: none;
    }
    /* Opacity compounds, so rows already dimmed inside a locked section would almost vanish. */
    .resize-section.is-locked .is-disabled {
        opacity: 1;
    }

    /* Utility classes for repeated patterns */
    .label-nowrap {
        white-space: nowrap;
    }
`;
