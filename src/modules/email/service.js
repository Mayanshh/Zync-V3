import { notificationQueue } from '../jobs/notification.queue.js';

// Inside Signup Controller
await notificationQueue.add('sendEmail', {
  type: 'WELCOME_EMAIL',
  payload: { email: user.email, name: user.displayName }
});