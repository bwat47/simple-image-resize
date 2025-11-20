// Mock for Joplin API
export default {
    settings: {
        value: jest.fn().mockResolvedValue('widthAndHeight'),
    },
};
