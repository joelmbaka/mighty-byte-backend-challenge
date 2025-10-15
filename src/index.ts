import express from 'express';
import { Storage } from './storage';
import { DeliveryManager } from './delivery';

const PORT = Number(process.env.PORT || 3000);

function generateCode(length = 5): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

async function bootstrap() {
  const app = express();
  app.use(express.json());

  const storage = new Storage(process.cwd());
  await storage.init();

  const delivery = new DeliveryManager(storage, {
    intervalMs: Number(process.env.DELIVERY_INTERVAL_MS || 1000),
    baseDelayMs: Number(process.env.DELIVERY_BASE_DELAY_MS || 1000),
    maxDelayMs: Number(process.env.DELIVERY_MAX_DELAY_MS || 300000),
  });
  delivery.start();

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/url', async (req, res) => {
    const { url, callbackUrl } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Missing required field: url (string)' });
    }

    if (!callbackUrl || typeof callbackUrl !== 'string') {
      return res.status(400).json({ error: 'Missing required field: callbackUrl (string). This server delivers results asynchronously via HTTP callback.' });
    }

    // generate unique code
    let code = generateCode(5);
    // Simple collision avoidance
    // eslint-disable-next-line no-constant-condition
    while (await storage.getUrl(code)) {
      code = generateCode(5);
    }

    await storage.setUrl(code, url);

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const shortenedURL = `${baseUrl.replace(/\/$/, '')}/${code}`;

    const correlationId = await delivery.enqueueDelivery(callbackUrl, { shortenedURL });

    // Do not return the result in the response per the challenge requirements
    return res.status(202).json({ accepted: true, correlationId });
  });

  app.get('/:code', async (req, res) => {
    const { code } = req.params;
    if (!code || code.length !== 5) {
      return res.status(404).json({ error: 'Not found' });
    }
    const original = await storage.getUrl(code);
    if (!original) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.json({ url: original });
  });

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
