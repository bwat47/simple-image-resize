/**
 * Joplin settings registration for Simple Image Resize plugin.
 *
 * Integrates resize configuration into Joplin's preferences UI, allowing
 * users to customize default resize mode and context menu behavior through
 * Settings > Simple Image Resize.
 *
 * Also maintains an in-memory settings cache to avoid async reads on every operation.
 */

import joplin from 'api';
import { SettingItem, SettingItemType } from 'api/types';
import { logger } from './logger';

const SECTION_ID = 'imageResize';

const SETTINGS_CONFIG = {
    defaultResizeMode: {
        key: `${SECTION_ID}.defaultResizeMode`,
        defaultValue: 'percentage' as 'percentage' | 'absolute',
        type: SettingItemType.String,
        label: 'Default resize mode',
        description: 'The resize mode that will be selected by default when opening the resize dialog',
        isEnum: true,
        options: {
            percentage: 'Percentage',
            absolute: 'Absolute size',
        },
    },
    defaultPercentage: {
        key: `${SECTION_ID}.defaultPercentage`,
        defaultValue: 50,
        type: SettingItemType.Int,
        label: 'Default percentage',
        description: 'The default percentage value (1-100) when using percentage resize mode',
        minimum: 1,
        maximum: 100,
        step: 1,
    },
    htmlSyntaxStyle: {
        key: `${SECTION_ID}.htmlSyntaxStyle`,
        defaultValue: 'widthAndHeight' as 'widthAndHeight' | 'widthOnly',
        type: SettingItemType.String,
        label: 'HTML syntax style',
        description: 'Controls whether HTML image tags include both width and height attributes or just width',
        isEnum: true,
        options: {
            widthAndHeight: 'Width and height',
            widthOnly: 'Width only',
        },
    },
    showQuickResizeInContextMenu: {
        key: `${SECTION_ID}.showQuickResizeInContextMenu`,
        defaultValue: false,
        type: SettingItemType.Bool,
        label: 'Display quick resize options in context menu',
        description: '[Desktop Only] Show quick resize options (25%, 50%, 75%, 100%) in the right-click context menu',
    },
    showCopyImageInContextMenu: {
        key: `${SECTION_ID}.showCopyImageInContextMenu`,
        defaultValue: false,
        type: SettingItemType.Bool,
        label: 'Display copy image option in context menu',
        description:
            '[Desktop Only] Show "Copy Image" option in the right-click context menu to copy images to clipboard',
    },
    showToastMessages: {
        key: `${SECTION_ID}.showToastMessages`,
        defaultValue: true,
        type: SettingItemType.Bool,
        label: 'Show toast notifications',
        description: 'Display brief notification messages for plugin actions',
    },
} as const;

export type SettingsCache = {
    defaultResizeMode: 'percentage' | 'absolute';
    defaultPercentage: number;
    htmlSyntaxStyle: 'widthAndHeight' | 'widthOnly';
    showQuickResizeInContextMenu: boolean;
    showCopyImageInContextMenu: boolean;
    showToastMessages: boolean;
};

/**
 * Module-level settings cache for synchronous access
 */
export const settingsCache: SettingsCache = {
    defaultResizeMode: SETTINGS_CONFIG.defaultResizeMode.defaultValue,
    defaultPercentage: SETTINGS_CONFIG.defaultPercentage.defaultValue,
    htmlSyntaxStyle: SETTINGS_CONFIG.htmlSyntaxStyle.defaultValue,
    showQuickResizeInContextMenu: SETTINGS_CONFIG.showQuickResizeInContextMenu.defaultValue,
    showCopyImageInContextMenu: SETTINGS_CONFIG.showCopyImageInContextMenu.defaultValue,
    showToastMessages: SETTINGS_CONFIG.showToastMessages.defaultValue,
};

/**
 * Updates the settings cache by reading all values from Joplin settings
 */
async function updateSettingsCache(): Promise<void> {
    for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
        (settingsCache as Record<string, unknown>)[key] = await joplin.settings.value(config.key);
    }
    logger.debug('Settings cache updated:', settingsCache);
}

/**
 * Initializes the settings cache and registers change listener.
 * Must be called once during plugin initialization, after registerSettings().
 */
export async function initializeSettingsCache(): Promise<void> {
    await updateSettingsCache();

    joplin.settings.onChange(async (event) => {
        const settingKeys = Object.values(SETTINGS_CONFIG).map((c) => c.key) as string[];
        if (event.keys.some((key) => settingKeys.includes(key))) {
            await updateSettingsCache();
        }
    });

    logger.debug('Settings cache initialized');
}

export async function registerSettings(): Promise<void> {
    await joplin.settings.registerSection(SECTION_ID, {
        label: 'Simple Image Resize',
        iconName: 'fas fa-expand-alt',
    });

    const settingsSpec: Record<string, SettingItem> = {};
    for (const config of Object.values(SETTINGS_CONFIG)) {
        const spec: SettingItem = {
            value: config.defaultValue,
            type: config.type,
            section: SECTION_ID,
            public: true,
            label: config.label,
            description: config.description,
        };

        if ('isEnum' in config) {
            spec.isEnum = config.isEnum;
            spec.options = config.options;
        }
        if ('minimum' in config) spec.minimum = config.minimum;
        if ('maximum' in config) spec.maximum = config.maximum;
        if ('step' in config) spec.step = config.step;

        settingsSpec[config.key] = spec;
    }

    await joplin.settings.registerSettings(settingsSpec);
}
