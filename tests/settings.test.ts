import joplin from 'api';
import type { Mock, MockInstance } from 'vitest';
import { initializeSettingsCache, settingsCache } from '../src/settings';
import { QUICK_RESIZE_OPTIONS_DEFAULT } from '../src/quickResizeOptions';

const SETTING_VALUES = {
    defaultResizeMode: 'percentage',
    defaultPercentage: 50,
    htmlSyntaxStyle: 'widthAndHeight',
    showQuickResizeInContextMenu: false,
    quickResizeOptions: QUICK_RESIZE_OPTIONS_DEFAULT,
    showToastMessages: true,
} as const;

const getSettingKey = (settingName: keyof typeof SETTING_VALUES): string => `imageResize.${settingName}`;

describe('initializeSettingsCache', () => {
    const settingsValues = new Map<string, unknown>();
    let onChangeHandler: ((event: { keys: string[] }) => void) | undefined;
    let consoleInfoSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        settingsValues.clear();

        for (const [settingName, value] of Object.entries(SETTING_VALUES)) {
            settingsValues.set(`imageResize.${settingName}`, value);
        }

        (joplin.settings.values as Mock).mockImplementation((keys: string[]) =>
            Promise.resolve(Object.fromEntries(keys.map((key) => [key, settingsValues.get(key)])))
        );
        (joplin.settings.onChange as Mock).mockImplementation((handler: typeof onChangeHandler) => {
            onChangeHandler = handler;
            return Promise.resolve();
        });
    });

    afterEach(() => {
        consoleInfoSpy.mockRestore();
    });

    it('normalizes quick resize options when settings are initialized', async () => {
        settingsValues.set(getSettingKey('quickResizeOptions'), '100%, 500inches, 300px, 900%, 75%');

        await initializeSettingsCache();

        expect(settingsCache.quickResizeOptions).toBe('100%, 300px, 75%');
        expect(joplin.settings.setValue).toHaveBeenCalledWith(getSettingKey('quickResizeOptions'), '100%, 300px, 75%');
    });

    it('normalizes quick resize options after settings change', async () => {
        await initializeSettingsCache();

        settingsValues.set(getSettingKey('quickResizeOptions'), '');
        onChangeHandler?.({ keys: [getSettingKey('quickResizeOptions')] });

        await vi.waitFor(() => {
            expect(settingsCache.quickResizeOptions).toBe(QUICK_RESIZE_OPTIONS_DEFAULT);
            expect(joplin.settings.setValue).toHaveBeenCalledWith(
                getSettingKey('quickResizeOptions'),
                QUICK_RESIZE_OPTIONS_DEFAULT
            );
        });
    });

    it('reports failed cache updates from the change listener', async () => {
        await initializeSettingsCache();
        const error = new Error('Settings read failed');
        vi.mocked(joplin.settings.values).mockRejectedValueOnce(error);
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        try {
            onChangeHandler?.({ keys: [getSettingKey('quickResizeOptions')] });
            await vi.waitFor(() => {
                expect(consoleErrorSpy).toHaveBeenCalledWith('[Image Resize]', 'Settings cache update failed:', error);
            });
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('propagates change listener registration failures during initialization', async () => {
        const error = new Error('Listener registration failed');
        vi.mocked(joplin.settings.onChange).mockRejectedValueOnce(error);
        await expect(initializeSettingsCache()).rejects.toThrow(error);
    });

    it('does not write back unchanged quick resize options', async () => {
        await initializeSettingsCache();

        expect(settingsCache.quickResizeOptions).toBe(QUICK_RESIZE_OPTIONS_DEFAULT);
        expect(joplin.settings.setValue).not.toHaveBeenCalled();
    });

    it('stores valid setting values in the cache', async () => {
        settingsValues.set(getSettingKey('defaultResizeMode'), 'absolute');
        settingsValues.set(getSettingKey('defaultPercentage'), 25);
        settingsValues.set(getSettingKey('htmlSyntaxStyle'), 'widthOnly');
        settingsValues.set(getSettingKey('showToastMessages'), false);

        await initializeSettingsCache();

        expect(settingsCache.defaultResizeMode).toBe('absolute');
        expect(settingsCache.defaultPercentage).toBe(25);
        expect(settingsCache.htmlSyntaxStyle).toBe('widthOnly');
        expect(settingsCache.showToastMessages).toBe(false);
    });

    it('falls back to defaults when stored values fail validation', async () => {
        settingsValues.set(getSettingKey('defaultResizeMode'), 'constructor');
        settingsValues.set(getSettingKey('defaultPercentage'), 5000);
        settingsValues.set(getSettingKey('htmlSyntaxStyle'), 'toString');
        settingsValues.set(getSettingKey('showQuickResizeInContextMenu'), 'yes');
        settingsValues.set(getSettingKey('showToastMessages'), 1);

        await initializeSettingsCache();

        expect(settingsCache.defaultResizeMode).toBe('percentage');
        expect(settingsCache.defaultPercentage).toBe(50);
        expect(settingsCache.htmlSyntaxStyle).toBe('widthAndHeight');
        expect(settingsCache.showQuickResizeInContextMenu).toBe(false);
        expect(settingsCache.showToastMessages).toBe(true);
    });
});
