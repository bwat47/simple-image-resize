import type { Mock } from 'vitest';

import type { DialogResult } from 'api/types';
import type { JoplinDialogApi } from '../../src/host/resizeDialogHost';

type MockedDialogApi = {
    [K in keyof JoplinDialogApi]: Mock<JoplinDialogApi[K]>;
};

/** Serializes a form the way Joplin's webview does: one entry per `FormData` key, keyed by form name. */
export function serializeForm(form: HTMLFormElement): Record<string, Record<string, FormDataEntryValue>> {
    return { [form.getAttribute('name')!]: Object.fromEntries(new FormData(form)) };
}

/**
 * Fake Joplin dialog API backed by jsdom. `setHtml` mounts the dialog HTML into
 * `document.body`, and `open` delegates to `onOpen` (or cancels by default).
 */
export function createDialogApi(
    onOpen?: (form: HTMLFormElement) => DialogResult | null | Promise<DialogResult | null>
): MockedDialogApi {
    return {
        create: vi.fn<JoplinDialogApi['create']>().mockResolvedValue('handle'),
        setFitToContent: vi.fn<JoplinDialogApi['setFitToContent']>().mockResolvedValue(undefined),
        addScript: vi.fn<JoplinDialogApi['addScript']>().mockResolvedValue(undefined),
        setButtons: vi.fn<JoplinDialogApi['setButtons']>().mockResolvedValue(undefined),
        setHtml: vi.fn<JoplinDialogApi['setHtml']>().mockImplementation((_handle, html) => {
            document.body.innerHTML = html;
            return Promise.resolve(undefined);
        }),
        open: vi.fn<JoplinDialogApi['open']>().mockImplementation(() => {
            const form = document.querySelector('form')!;
            if (onOpen) {
                return Promise.resolve(onOpen(form));
            }
            return Promise.resolve({ id: 'cancel' });
        }),
    } satisfies JoplinDialogApi;
}
