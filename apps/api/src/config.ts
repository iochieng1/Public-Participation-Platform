function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

/**
 * Demo mode: with no SMS gateway, sign-in codes are returned to the browser so a
 * reviewer can try the app without a phone. It can never be on in production.
 */
export function resolveDemoMode(env: NodeJS.ProcessEnv): boolean {
  const smsProvider = env.SMS_PROVIDER ?? 'console';
  if (env.NODE_ENV === 'production' && smsProvider === 'console') {
    throw new Error('SMS_PROVIDER=console is not allowed in production; configure Africa\'s Talking');
  }
  return smsProvider === 'console' && env.DEMO_MODE !== 'false';
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  demoMode: resolveDemoMode(process.env),
  jwtSecret: required('JWT_SECRET'),
  callbackToken: required('CALLBACK_TOKEN'),
  smsProvider: process.env.SMS_PROVIDER ?? 'console',
  at: {
    username: process.env.AT_USERNAME ?? 'sandbox',
    apiKey: process.env.AT_API_KEY ?? '',
    senderId: process.env.AT_SENDER_ID || undefined,
  },
  // Policy, not law: the shortest window a consultation may be open for.
  // Counties should set this in their public participation regulations.
  minConsultationDays: Number(process.env.MIN_CONSULTATION_DAYS ?? 14),
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:5173',
};
