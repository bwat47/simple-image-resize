export class DialogLock {
    private locked = false;

    isLocked(): boolean {
        return this.locked;
    }

    tryAcquire(): boolean {
        const wasLocked = this.locked;
        this.locked = true;
        return !wasLocked;
    }

    release(): void {
        this.locked = false;
    }
}

export const resizeDialogLock = new DialogLock();
