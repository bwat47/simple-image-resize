const PREFIX = '[Image Resize]';

type LoggerMethod = (message: string, ...args: unknown[]) => void;

function createLoggerMethod(consoleMethod: (...args: unknown[]) => void): LoggerMethod {
    return (message: string, ...args: unknown[]) => {
        consoleMethod(PREFIX, message, ...args);
    };
}

export const logger = {
    debug: createLoggerMethod(console.info),
    info: createLoggerMethod(console.info),
    warn: createLoggerMethod(console.warn),
    error: createLoggerMethod(console.error),
};
