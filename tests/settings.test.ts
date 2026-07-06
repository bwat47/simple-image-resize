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
    let onChangeHandler: ((event: { keys: string[] }) => Promise<void>) | undefined;
    let consoleInfoSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        settingsValues.clear();

        for (const [settingName, value] of Object.entries(SETTING_VALUES)) {
            settingsValues.set(`imageResize.${settingName}`, value);
        }

        (joplin.settings.value as Mock).mockImplementation(async (key: string) => settingsValues.get(key));
        (joplin.settings.onChange as Mock).mockImplementation(async (handler) => {
            onChangeHandler = handler;
        });
    });

    afterEach(() => {
        consoleInfoSpy.mockRestore();
    });

    it('normalizes quick resize options when settings are initialized', async () => {
        settingsValues.set(getSettingKey('quickResizeOptions'), '100%, 500inches, 300px, 900%, 75%');

        await initializeSettingsCache();

        expect(settingsCache.quickResizeOptions).toBe('100%, 300px, 75%');
        expect(joplin.settings.setValue).toHaveBeenCalledWith(
            getSettingKey('quickResizeOptions'),
            '100%, 300px, 75%'
        );
    });

    it('normalizes quick resize options after settings change', async () => {
        await initializeSettingsCache();

        settingsValues.set(getSettingKey('quickResizeOptions'), '');
        await onChangeHandler?.({ keys: [getSettingKey('quickResizeOptions')] });

        expect(settingsCache.quickResizeOptions).toBe(QUICK_RESIZE_OPTIONS_DEFAULT);
        expect(joplin.settings.setValue).toHaveBeenCalledWith(
            getSettingKey('quickResizeOptions'),
            QUICK_RESIZE_OPTIONS_DEFAULT
        );
    });

    it('does not write back unchanged quick resize options', async () => {
        await initializeSettingsCache();

        expect(settingsCache.quickResizeOptions).toBe(QUICK_RESIZE_OPTIONS_DEFAULT);
        expect(joplin.settings.setValue).not.toHaveBeenCalled();
    });
});
