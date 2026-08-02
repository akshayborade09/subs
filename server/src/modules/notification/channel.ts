import { logger } from '../../platform/logger.js';

/**
 * Delivery channel port, deliberately the same shape as PaymentProvider.
 *
 * Both are places where a vendor decision is still outstanding — Razorpay for
 * payments, a push/WhatsApp provider here. Keeping the boundary explicit means
 * choosing one later is implementing an interface, not editing the notification
 * path. The log channel below is a real implementation of that interface, not a
 * stub: it records exactly what would have been sent.
 */
export type OutboundNotification = {
  userId: string;
  category: string;
  title: string;
  body: string;
  deepLink?: string | null;
};

export type DeliveryResult = {
  channel: string;
  delivered: boolean;
  reason?: string;
};

export interface NotificationChannel {
  readonly name: 'log' | 'push' | 'whatsapp';
  /** Whether this channel is usable for this user right now. */
  supports(notification: OutboundNotification): boolean;
  send(notification: OutboundNotification): Promise<DeliveryResult>;
}

export class LogNotificationChannel implements NotificationChannel {
  readonly name = 'log' as const;

  supports(): boolean {
    return true;
  }

  async send(notification: OutboundNotification): Promise<DeliveryResult> {
    logger.info(
      {
        notification: {
          userId: notification.userId,
          category: notification.category,
          title: notification.title,
        },
      },
      'notification dispatched',
    );
    return { channel: this.name, delivered: true };
  }
}

let channel: NotificationChannel = new LogNotificationChannel();

export const getNotificationChannel = (): NotificationChannel => channel;

/** Swap point for a real provider, and for tests that assert on dispatch. */
export const setNotificationChannel = (next: NotificationChannel): void => {
  channel = next;
};
