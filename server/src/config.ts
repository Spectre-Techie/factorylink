import dotenv from 'dotenv';

dotenv.config();

function getStringEnv(name: string): string {
  const value = process.env[name];

  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  appName: 'FactoryLink',
  environment: getStringEnv('NODE_ENV'),
  port: Number(process.env.PORT ?? 4000),
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000',
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    anonKey: process.env.SUPABASE_ANON_KEY ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    dbUrl: process.env.SUPABASE_DB_URL ?? '',
  },
  africaTalking: {
    environment: getStringEnv('AT_ENVIRONMENT'),
    username: getStringEnv('AT_USERNAME'),
    apiKey: getStringEnv('AT_API_KEY'),
    baseUrl: process.env.AT_BASE_URL ?? 'https://api.africastalking.com',
    senderId: process.env.AT_SENDER_ID ?? 'FactoryLink',
  },
};

export function assertServerConfig(): void {
  const required = [
    'NODE_ENV',
    'AT_ENVIRONMENT',
    'AT_USERNAME',
    'AT_API_KEY',
  ] as const;

  for (const key of required) {
    getStringEnv(key);
  }
}
