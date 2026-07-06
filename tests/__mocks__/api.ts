// Mock for Joplin API
export default {
    settings: {
        value: vi.fn().mockResolvedValue('widthAndHeight'),
        setValue: vi.fn().mockResolvedValue(undefined),
        onChange: vi.fn().mockResolvedValue(undefined),
        registerSection: vi.fn().mockResolvedValue(undefined),
        registerSettings: vi.fn().mockResolvedValue(undefined),
    },
};
