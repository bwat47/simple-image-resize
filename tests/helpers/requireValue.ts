/** Fail a test clearly when a value expected from a fixture or mock is missing. */
export function requireValue<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(`Expected ${description} to exist.`);
    }
    return value;
}
