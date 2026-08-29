import express from 'express';

import { assertServerConfig, config } from './config.js';

assertServerConfig();

const app = express();
const port = config.port;

app.get('/health', (_req, res) => {
  res.status(200).json({
    application: config.appName,
    environment: config.environment,
    apiStatus: 'ok',
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`FactoryLink API listening on port ${port}`);
});
