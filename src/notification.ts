import { Notification } from 'electron';
import * as path from 'path';

export function sendWindowsNotification(title: string, message: string): void {
    console.log(`[Notification] Sending: ${title}`);

    if (Notification.isSupported()) {
        const notification = new Notification({
            title: title,
            body: message,
            icon: path.join(__dirname, '../renderer/kiosk-icon.png'),
            timeoutType: 'default'
        });

        notification.show();
        console.log('[Notification] Sent successfully');
    } else {
        console.error('[Notification] Not supported on this system');
    }
}
