// Mock for Joplin API
export default {
    settings: {
        value: jest.fn().mockResolvedValue('widthAndHeight'),
        setValue: jest.fn().mockResolvedValue(undefined),
        onChange: jest.fn().mockResolvedValue(undefined),
        registerSection: jest.fn().mockResolvedValue(undefined),
        registerSettings: jest.fn().mockResolvedValue(undefined),
    },
};
