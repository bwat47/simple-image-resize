export class DialogLock {
    private locked = false;

    isLocked(): boolean {
        return this.locked;
    }

    tryAcquire(): boolean {
        if (this.locked) {
            return false;
        }

        this.locked = true;
        return true;
    }

    release(): void {
        this.locked = false;
    }
}

export const resizeDialogLock = new DialogLock();
