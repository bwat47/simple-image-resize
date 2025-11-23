/**
 * Joplin settings registration for Simple Image Resize plugin.
 *
 * Integrates resize configuration into Joplin's preferences UI, allowing
 * users to customize default resize mode and context menu behavior through
 * Settings > Simple Image Resize.
 *
 * See:
 * - index.ts - Calls registerSettings() on plugin startup
 * - dialogHandler.ts - Loads defaultResizeMode setting
 */

import joplin from 'api';
import { SettingItemType } from 'api/types';

const SECTION_ID = 'imageResize';
export const SETTING_DEFAULT_RESIZE_MODE = 'imageResize.defaultResizeMode';
export const SETTING_SHOW_QUICK_RESIZE_IN_CONTEXT_MENU = 'imageResize.showQuickResizeInContextMenu';
export const SETTING_HTML_SYNTAX_STYLE = 'imageResize.htmlSyntaxStyle';
export const SETTING_SHOW_TOAST_MESSAGES = 'imageResize.showToastMessages';

export async function registerSettings(): Promise<void> {
    await joplin.settings.registerSection(SECTION_ID, {
        label: 'Simple Image Resize',
        iconName: 'fas fa-expand-alt',
    });

    await joplin.settings.registerSettings({
        [SETTING_DEFAULT_RESIZE_MODE]: {
            value: 'percentage',
            type: SettingItemType.String,
            section: SECTION_ID,
            public: true,
            label: 'Default resize mode',
            description: 'The resize mode that will be selected by default when opening the resize dialog',
            isEnum: true,
            options: {
                percentage: 'Percentage',
                absolute: 'Absolute size',
            },
        },
        [SETTING_HTML_SYNTAX_STYLE]: {
            value: 'widthAndHeight',
            type: SettingItemType.String,
            section: SECTION_ID,
            public: true,
            label: 'HTML syntax style',
            description: 'Controls whether HTML image tags include both width and height attributes or just width',
            isEnum: true,
            options: {
                widthAndHeight: 'Width and height',
                widthOnly: 'Width only',
            },
        },
        [SETTING_SHOW_QUICK_RESIZE_IN_CONTEXT_MENU]: {
            value: false,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Display quick resize options in context menu',
            description: 'Show quick resize options (25%, 50%, 75%, 100%) in the right-click context menu',
        },
        [SETTING_SHOW_TOAST_MESSAGES]: {
            value: true,
            type: SettingItemType.Bool,
            section: SECTION_ID,
            public: true,
            label: 'Show toast notifications',
            description: 'Display brief notification messages for plugin actions',
        },
    });
}
