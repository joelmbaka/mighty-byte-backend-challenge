# MightyByte Backend Challenge - URL Shortener (TypeScript + Express)

Minimal TypeScript + Express server that:

- Shortens URLs by generating a 5-character alphanumeric code.
- Persists mappings to simple JSON files (no database).
- Delivers the shortened URL to the client asynchronously via HTTP callback (webhook), with retries and exponential backoff until acknowledged.
- Supports retrieval via `GET /:code` to return `{ "url": original }`.

## How it works

- POST `/url` expects JSON:
  ```json
  { "url": "classcalc.com", "callbackUrl": "http://localhost:4000/callback" }
  ```
- The server generates a random 5-character code, stores the mapping, and computes the shortened URL like `http://localhost:3000/a2b34`.
- Instead of returning the result in the HTTP response, the server POSTs to `callbackUrl` with:
  ```json
  { "shortenedURL": "http://localhost:3000/a2b34" }
  ```
- A 2xx response from the callback endpoint is considered an acknowledgment. If delivery fails (network errors, non-2xx), the server retries with exponential backoff (1s, 2s, 4s, ... capped at 5 minutes) indefinitely until success. Pending deliveries survive restarts via file persistence.
- The client can then GET `/:code` to retrieve the original URL:
  ```json
  { "url": "classcalc.com" }
  ```

## Project structure

- `src/index.ts` — Express app and routes.
- `src/storage.ts` — Async JSON file persistence for URLs and pending deliveries.
- `src/delivery.ts` — Delivery manager with retry/backoff.
- `src/types.ts` — Shared types.
- `data/` — JSON persistence files created at runtime.
- `scripts/mock-callback.js` — Simple mock client (Express) to receive asynchronous results.

## Prerequisites

- Node.js v18+ recommended
- npm

## Setup

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Start the server in dev mode:
   ```powershell
   npm run dev
   ```
   Or build and start:
   ```powershell
   npm run build && npm start
   ```

## Configuration

Environment variables (optional):

- `PORT` — server port (default: 3000)
- `BASE_URL` — base URL used when constructing the shortened URL (default: derived from request host, e.g., `http://localhost:3000`)
- `DELIVERY_INTERVAL_MS` — how often to process pending deliveries (default: 1000)
- `DELIVERY_BASE_DELAY_MS` — initial retry delay (default: 1000)
- `DELIVERY_MAX_DELAY_MS` — max retry delay cap (default: 300000)

PowerShell example:

```powershell
$env:PORT = "3000"
$env:BASE_URL = "http://localhost:3000"
$env:DELIVERY_INTERVAL_MS = "1000"
$env:DELIVERY_BASE_DELAY_MS = "1000"
$env:DELIVERY_MAX_DELAY_MS = "300000"
```

## Example usage

1. In one terminal, run the mock callback receiver:
   ```powershell
   node scripts/mock-callback.js
   ```
   It will listen at `http://localhost:4000/callback`.

2. In another terminal, start the server:
   ```powershell
   npm run dev
   ```

3. Trigger URL shortening (note this does not return the result in the response):
   ```powershell
   # Build JSON body
   $body = @{ 
     url = "classcalc.com"
     callbackUrl = "http://localhost:4000/callback"
   } | ConvertTo-Json

   Invoke-RestMethod -Method POST `
     -Uri "http://localhost:3000/url" `
     -ContentType "application/json" `
     -Body $body
   ```
   You should see the mock client log something like:
   ```
   Received async result from server: { shortenedURL: 'http://localhost:3000/a2b34' }
   ```

4. Retrieve original URL via the shortened code:
   ```powershell
   # Replace a2b34 with the code you received in the callback
   Invoke-RestMethod -Method GET -Uri "http://localhost:3000/a2b34"
   # -> { "url": "classcalc.com" }
   ```

## Notes

- The server intentionally does not return the shortened URL in the `POST /url` response. It returns `{ accepted: true, correlationId }` to confirm queuing.
- This implementation uses HTTP callbacks (webhooks) for asynchronous delivery. The acknowledgment is the 2xx HTTP response from the client, and retries continue until acknowledged.
- Persistence is file-based only (no DB), and all read/write operations are asynchronous.

## AI Tools Disclosure

I used AI to scaffold the express server, storage and delivery mechanisms. 
AI wrote my readme quickly following my instructions
