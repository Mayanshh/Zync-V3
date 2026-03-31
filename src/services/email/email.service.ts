import { Resend } from 'resend';
import { env } from '../../config/env.js';

const resend = new Resend(env.RESEND_API_KEY);

export class EmailService {
  /**
   * Sends an email when someone sends a connection request.
   */
  static async sendConnectionNotice(to: string, senderName: string) {
    try {
      return await resend.emails.send({
        // Use 'onboarding@resend.dev' for testing until your domain is verified
        from: 'Zync <alerts@zync.app>', 
        to,
        subject: `✨ New Connection Request from ${senderName}`,
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h2>Connection Request!</h2>
            <p><strong>${senderName}</strong> wants to zync with you!</p>
            <p>Open the app to accept and start chatting.</p>
            <hr />
            <small>Team Zync</small>
          </div>
        `
      });
    } catch (error) {
      console.error('Email Error (Connection):', error);
    }
  }

  /**
   * Sends a welcome email to new users.
   */
  static async sendWelcomeEmail(to: string, name: string) {
    try {
      return await resend.emails.send({
        from: 'Zync <welcome@zync.app>',
        to,
        subject: 'Welcome to the Grid 🌐',
        html: `
          <div style="font-family: sans-serif; color: #333;">
            <h1>Welcome, ${name}!</h1>
            <p>Thanks for joining Zync. You're now part of a proximity-based network built for real-world interaction.</p>
            <p>Go ahead, find someone nearby and make a connection.</p>
            <br />
            <p>Stay Zynced,</p>
            <p><strong>The Zync Team</strong></p>
          </div>
        `
      });
    } catch (error) {
      console.error('Email Error (Welcome):', error);
    }
  }
}