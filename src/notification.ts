import { Notification } from 'electron';

export function sendWindowsNotification(title: string, message: string): void {
    console.log(`[Notification] Sending: ${title}`);

    if (Notification.isSupported()) {
        const notification = new Notification({
            title: title,
            body: message,
            timeoutType: 'default'
        });

        notification.show();
        console.log('[Notification] Sent successfully');
    } else {
        console.error('[Notification] Not supported on this system');
    }
}
