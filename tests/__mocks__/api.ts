// Mock for Joplin API
export default {
    data: {
        get: vi.fn(),
        resourcePath: vi.fn(),
    },
    commands: {
        execute: vi.fn(),
    },
    settings: {
        values: vi.fn().mockResolvedValue({}),
        setValue: vi.fn().mockResolvedValue(undefined),
        onChange: vi.fn().mockResolvedValue(undefined),
        registerSection: vi.fn().mockResolvedValue(undefined),
        registerSettings: vi.fn().mockResolvedValue(undefined),
    },
};
