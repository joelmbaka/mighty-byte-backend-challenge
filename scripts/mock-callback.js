const express = require('express');
const app = express();
app.use(express.json());

const PORT = process.env.MOCK_PORT || 4000;

app.post('/callback', (req, res) => {
  console.log('Received async result from server:', req.body);
  // Simulate processing, then acknowledge with 200
  res.json({ ack: true });
});

app.listen(PORT, () => {
  console.log(`Mock client listening on http://localhost:${PORT}`);
  console.log('POST callback URL to use:', `http://localhost:${PORT}/callback`);
});
