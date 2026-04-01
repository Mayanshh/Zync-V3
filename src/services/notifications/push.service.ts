import webPush from 'web-push';
import { env } from '../../config/env.js';

// Setup VAPID keys (Generate once: npx web-push generate-vapid-keys)
webPush.setVapidDetails(
  'mailto:dev@zync.com', 
  env.VAPID_PUBLIC_KEY, 
  env.VAPID_PRIVATE_KEY
);

export class PushService {
  static async send(subscription: any, title: string, body: string) {
    try {
      const payload = JSON.stringify({ 
        title, 
        body, 
        icon: 'https://zync.com/logo.png',
        badge: 'https://zync.com/badge.png' 
      });
      
      await webPush.sendNotification(subscription, payload);
      return true;
    } catch (error: any) {
      // If the subscription is expired/invalid (410), we should remove it from the DB
      if (error.statusCode === 410) {
        console.warn('[Push] Subscription expired. Should be purged.');
      }
      return false;
    }
  }
}