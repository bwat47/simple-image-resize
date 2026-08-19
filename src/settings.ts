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
import { normalizeQuickResizeOptionsSetting, QUICK_RESIZE_OPTIONS_DEFAULT } from './quickResizeOptions';
import type { ResizeMode } from './types';

const SECTION_ID = 'imageResize';

const SETTINGS_CONFIG = {
    defaultResizeMode: {
        key: `${SECTION_ID}.defaultResizeMode`,
        defaultValue: 'percentage' as ResizeMode,
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
        description: '[Desktop Only] Show configured quick resize options in the right-click context menu',
    },
    quickResizeOptions: {
        key: `${SECTION_ID}.quickResizeOptions`,
        defaultValue: QUICK_RESIZE_OPTIONS_DEFAULT,
        type: SettingItemType.String,
        label: 'Quick resize options',
        description:
            'Comma-separated list that determines the Quick resize options. Use 1-5 positive whole-number values, with units (percent or pixels), e.g.: 100%, 75%, 300px.',
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
    defaultResizeMode: ResizeMode;
    defaultPercentage: number;
    htmlSyntaxStyle: 'widthAndHeight' | 'widthOnly';
    showQuickResizeInContextMenu: boolean;
    quickResizeOptions: string;
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
    quickResizeOptions: SETTINGS_CONFIG.quickResizeOptions.defaultValue,
    showToastMessages: SETTINGS_CONFIG.showToastMessages.defaultValue,
};

/**
 * Narrows a stored setting to one of its registered enum options.
 *
 * `options` comes straight from SETTINGS_CONFIG, so the accepted values can
 * never drift from what the settings UI offers.
 */
function readEnum<T extends string>(value: unknown, options: Record<T, string>, fallback: T): T {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(options, value) ? (value as T) : fallback;
}

function readBool(value: unknown, fallback: boolean): boolean {
    return typeof value === 'boolean' ? value : fallback;
}

function readInt(value: unknown, fallback: number, min: number, max: number): number {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

/**
 * Updates the settings cache by reading all values from Joplin settings.
 *
 * Uses `settings.values()` rather than the deprecated `settings.value()`: it reads
 * every key in one call, and it returns `unknown` instead of `any`, so each value
 * has to be narrowed before it reaches the cache.
 */
async function updateSettingsCache(): Promise<void> {
    const config = SETTINGS_CONFIG;
    const raw = await joplin.settings.values(Object.values(config).map((setting) => setting.key));

    const rawQuickResizeOptions = raw[config.quickResizeOptions.key];
    const normalizedQuickResizeOptions = normalizeQuickResizeOptionsSetting(
        typeof rawQuickResizeOptions === 'string' ? rawQuickResizeOptions : ''
    );

    // Typing the literal as SettingsCache makes a forgotten setting a compile error,
    // which a per-field assignment would not catch (the cache is pre-seeded with defaults).
    const next: SettingsCache = {
        defaultResizeMode: readEnum(
            raw[config.defaultResizeMode.key],
            config.defaultResizeMode.options,
            config.defaultResizeMode.defaultValue
        ),
        defaultPercentage: readInt(
            raw[config.defaultPercentage.key],
            config.defaultPercentage.defaultValue,
            config.defaultPercentage.minimum,
            config.defaultPercentage.maximum
        ),
        htmlSyntaxStyle: readEnum(
            raw[config.htmlSyntaxStyle.key],
            config.htmlSyntaxStyle.options,
            config.htmlSyntaxStyle.defaultValue
        ),
        showQuickResizeInContextMenu: readBool(
            raw[config.showQuickResizeInContextMenu.key],
            config.showQuickResizeInContextMenu.defaultValue
        ),
        quickResizeOptions: normalizedQuickResizeOptions,
        showToastMessages: readBool(raw[config.showToastMessages.key], config.showToastMessages.defaultValue),
    };

    // Assign in place: other modules import settingsCache by reference.
    Object.assign(settingsCache, next);

    if (normalizedQuickResizeOptions !== rawQuickResizeOptions) {
        // This setValue re-fires onChange, which re-runs updateSettingsCache.
        // Normalization must stay idempotent so the second pass finds an
        // already-normalized value and doesn't write again (infinite loop).
        await joplin.settings.setValue(config.quickResizeOptions.key, normalizedQuickResizeOptions);
        logger.info('Quick resize options setting normalized:', normalizedQuickResizeOptions);
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
