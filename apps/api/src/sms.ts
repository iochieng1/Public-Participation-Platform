import { config } from './config.js';

export interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

/** Development/test provider: logs and keeps an in-memory outbox. */
export class ConsoleSms implements SmsProvider {
  outbox: { to: string; message: string }[] = [];
  async send(to: string, message: string) {
    this.outbox.push({ to, message });
    if (process.env.NODE_ENV !== 'test') console.log(`[sms -> ${to}] ${message}`);
  }
}

export class AfricasTalkingSms implements SmsProvider {
  async send(to: string, message: string) {
    const host =
      config.at.username === 'sandbox' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
    const body = new URLSearchParams({ username: config.at.username, to, message });
    if (config.at.senderId) body.set('from', config.at.senderId);
    const res = await fetch(`https://${host}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: config.at.apiKey, Accept: 'application/json' },
      body,
    });
    if (!res.ok) throw new Error(`Africa's Talking SMS failed: ${res.status} ${await res.text()}`);
  }
}

export const sms: SmsProvider =
  config.smsProvider === 'africastalking' ? new AfricasTalkingSms() : new ConsoleSms();

/** Fire-and-forget: a failed SMS must never fail the citizen's submission. */
export function notify(to: string, message: string) {
  sms.send(to, message).catch((err) => console.error('SMS send failed', err));
}
