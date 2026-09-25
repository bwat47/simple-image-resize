// Mock for Joplin API
export default {
    data: {
        get: vi.fn(),
        resourcePath: vi.fn(),
    },
    commands: {
        execute: vi.fn(),
        register: vi.fn().mockResolvedValue(undefined),
    },
    settings: {
        globalValue: vi.fn(),
        values: vi.fn().mockResolvedValue({}),
        setValue: vi.fn().mockResolvedValue(undefined),
        onChange: vi.fn().mockResolvedValue(undefined),
        registerSection: vi.fn().mockResolvedValue(undefined),
        registerSettings: vi.fn().mockResolvedValue(undefined),
    },
    workspace: {
        filterEditorContextMenu: vi.fn(),
    },
    views: {
        dialogs: {
            showToast: vi.fn().mockResolvedValue(undefined),
        },
    },
};
