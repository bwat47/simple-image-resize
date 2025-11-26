import joplin from 'api';
import { ToastType } from 'api/types';
import { logger } from '../logger';
import { SETTING_SHOW_TOAST_MESSAGES } from '../settings';

// Re-export ToastType for convenience - callers can import everything toast-related from one place
export { ToastType } from 'api/types';

const DEFAULT_TOAST_DURATION = 3000;

/**
 * Displays a toast notification if toast messages are enabled in settings.
 *
 * @param message - The message to display
 * @param type - Toast type (Info, Warning, Error). Defaults to Info.
 * @param duration - Display duration in milliseconds. Defaults to 3000ms.
 */
export async function showToast(
    message: string,
    type: ToastType = ToastType.Info,
    duration = DEFAULT_TOAST_DURATION
): Promise<void> {
    try {
        const enabled = await joplin.settings.value(SETTING_SHOW_TOAST_MESSAGES);
        if (!enabled) return;

        await joplin.views.dialogs.showToast({ message, type, duration });
    } catch (err) {
        logger.warn(`Failed to show toast message "${message}":`, err);
    }
}
