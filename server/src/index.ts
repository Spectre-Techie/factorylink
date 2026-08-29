import express, { NextFunction, Request, Response } from 'express';

import { assertServerConfig, config } from './config.js';
import { createAfricaTalkingProvider } from './services/africastalking/provider.js';

assertServerConfig();

const app = express();
const port = config.port;
const africaTalkingProvider = createAfricaTalkingProvider(config.africaTalking);

app.use(express.json({ limit: '1mb' }));

app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  void next;

  if (err && typeof err === 'object' && 'type' in err && err.type === 'entity.parse.failed') {
    res.status(400).json({
      ok: false,
      provider: 'africastalking',
      type: 'sms',
      message: 'Invalid JSON payload. Please send a valid JSON object.',
      endpoint: '/dev/at/sandbox/sms-test',
      endpointType: 'development-sandbox-test',
      note: 'This is a development/Sandbox test endpoint only and is not a production business endpoint.',
      environment: config.africaTalking.environment,
    });
    return;
  }

  res.status(500).json({
    ok: false,
    provider: 'africastalking',
    type: 'sms',
    message: 'An internal sandbox test error occurred. No credentials were exposed.',
    endpoint: '/dev/at/sandbox/sms-test',
    endpointType: 'development-sandbox-test',
    note: 'This is a development/Sandbox test endpoint only and is not a production business endpoint.',
    environment: config.africaTalking.environment,
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    application: config.appName,
    environment: config.environment,
    apiStatus: 'ok',
    africaTalking: africaTalkingProvider.getDiagnostics(),
    timestamp: new Date().toISOString(),
  });
});

app.post('/dev/at/sandbox/sms-test', async (req: Request, res: Response) => {
  const payload = typeof req.body === 'object' && req.body !== null ? req.body : {};
  const recipient = typeof payload.recipient === 'string' ? payload.recipient : '';
  const message = typeof payload.message === 'string' ? payload.message : '';
  const senderId = typeof payload.senderId === 'string' ? payload.senderId : undefined;

  const response = await africaTalkingProvider.sendSms({ recipient, message, senderId });

  return res.status(response.ok ? 200 : 400).json({
    endpoint: '/dev/at/sandbox/sms-test',
    endpointType: 'development-sandbox-test',
    note: 'This is a development/Sandbox test endpoint only and is not a production business endpoint.',
    ...response,
    environment: config.africaTalking.environment,
  });
});

app.listen(port, () => {
  console.log(`FactoryLink API listening on port ${port}`);
  console.log('Africa\'s Talking sandbox readiness:', africaTalkingProvider.getDiagnostics());
});
