declare module 'africastalking' {
  type AfricaTalkingFormat = 'json' | 'xml';

  interface AfricaTalkingInitOptions {
    username: string;
    apiKey: string;
    format?: AfricaTalkingFormat;
  }

  interface AfricaTalkingSdk {
    SMS: unknown;
    USSD: unknown;
    VOICE: unknown;
    AIRTIME: unknown;
    TOKEN: unknown;
    APPLICATION: unknown;
    INSIGHTS: unknown;
    WHATSAPP: unknown;
    MOBILE_DATA: unknown;
  }

  const factory: (options: AfricaTalkingInitOptions) => AfricaTalkingSdk;

  export default factory;
}
