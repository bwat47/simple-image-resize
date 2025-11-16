/**
 * @fileoverview Centralized logger with configurable log levels.
 *
 * Provides consistent prefixing for all plugin logs and exposes runtime
 * controls via the browser console for dynamic log level adjustment.
 *
 * @usage
 * import logger from './logger';
 *
 * logger.warn('Warning message', { context: 'data' });
 * logger.error('Error occurred', error);
 *
 * // Runtime control via dev console:
 * joplinLogger.setLevel(0) // set log level
 * joplinLogger.getLevel() // get current log level
 *
 * modified from: https://github.com/cipherswami/joplin-plugin-quick-note/blob/main/src/logger.ts
 */

const PREFIX = '[Image Resize]';

/**
 * Log level enumeration.
 * Lower values indicate greater verbosity.
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4,
}

class Logger {
    private level: LogLevel;

    constructor(
        private prefix: string,
        initialLevel: LogLevel = LogLevel.INFO
    ) {
        this.level = initialLevel;
    }

    private getLevelName(level: number): string {
        return LogLevel[level] ?? 'UNKNOWN';
    }

    setLevel(level: LogLevel): void {
        // Validate that level is within valid range
        if (typeof level !== 'number' || level < LogLevel.DEBUG || level > LogLevel.NONE) {
            console.error(
                `${this.prefix} Invalid log level: ${level}. Valid range is ${LogLevel.DEBUG}-${LogLevel.NONE}`
            );
            return;
        }
        this.level = level;
        const levelName = this.getLevelName(level);
        console.info(`${this.prefix} Log level set to: ${levelName} (${level})`);
    }

    getLevel(): LogLevel {
        const levelName = this.getLevelName(this.level);
        console.info(`${this.prefix} Current log level: ${levelName} (${this.level})`);
        return this.level;
    }

    debug(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(this.prefix, message, ...args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.INFO) {
            console.info(this.prefix, message, ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.WARN) {
            console.warn(this.prefix, message, ...args);
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (this.level <= LogLevel.ERROR) {
            console.error(this.prefix, message, ...args);
        }
    }
}

function createLogger(prefix: string, initialLevel?: LogLevel): Logger {
    const loggerInstance = new Logger(prefix, initialLevel);

    // Expose logger controls to browser console for runtime debugging
    if (typeof window !== 'undefined') {
        (window as unknown as { joplinLogger: unknown }).joplinLogger = {
            setLevel: (level: LogLevel) => loggerInstance.setLevel(level),
            getLevel: () => loggerInstance.getLevel(),
            LogLevel, // Export enum for convenience
        };
    }

    return loggerInstance;
}

export const logger = createLogger(PREFIX, LogLevel.WARN);

export default logger;
