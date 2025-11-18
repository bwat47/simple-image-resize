import { DialogLock } from '../src/dialogLock';

describe('DialogLock', () => {
    it('acquires when unlocked', () => {
        const lock = new DialogLock();

        expect(lock.isLocked()).toBe(false);
        expect(lock.tryAcquire()).toBe(true);
        expect(lock.isLocked()).toBe(true);
    });

    it('prevents re-entry while locked', () => {
        const lock = new DialogLock();

        expect(lock.tryAcquire()).toBe(true);
        expect(lock.tryAcquire()).toBe(false);
        expect(lock.isLocked()).toBe(true);
    });

    it('allows acquisition after release', () => {
        const lock = new DialogLock();

        expect(lock.tryAcquire()).toBe(true);
        lock.release();
        expect(lock.isLocked()).toBe(false);
        expect(lock.tryAcquire()).toBe(true);
    });

    it('release is safe when already unlocked', () => {
        const lock = new DialogLock();

        lock.release();
        expect(lock.isLocked()).toBe(false);
    });
});
