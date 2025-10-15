import axios from 'axios';
import { Storage } from './storage';
import { DeliveryPayload, DeliveryRecord } from './types';

export interface DeliveryManagerOptions {
  intervalMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class DeliveryManager {
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(private storage: Storage, opts: DeliveryManagerOptions = {}) {
    this.intervalMs = opts.intervalMs ?? 1000; // check queue every 1s
    this.baseDelayMs = opts.baseDelayMs ?? 1000; // start retry at 1s
    this.maxDelayMs = opts.maxDelayMs ?? 5 * 60 * 1000; // cap at 5 minutes
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.processDue().catch(err => {
        console.error('DeliveryManager process error:', err);
      });
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private computeDelay(attempts: number): number {
    const delay = this.baseDelayMs * Math.pow(2, attempts);
    return Math.min(delay, this.maxDelayMs);
  }

  async enqueueDelivery(callbackUrl: string, payload: DeliveryPayload): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const record: DeliveryRecord = {
      id,
      callbackUrl,
      payload,
      attempts: 0,
      nextAttemptAt: Date.now(),
      createdAt: Date.now(),
      delivered: false,
    };
    await this.storage.addDelivery(record);
    return id;
  }

  private async processDue() {
    const now = Date.now();
    const due = await this.storage.getDueDeliveries(now);
    for (const d of due) {
      await this.attemptSend(d);
    }
  }

  private async attemptSend(d: DeliveryRecord) {
    try {
      const res = await axios.post(d.callbackUrl, d.payload, { timeout: 5000 });
      if (res.status >= 200 && res.status < 300) {
        await this.storage.markDelivered(d.id);
        return;
      }
      // Non-2xx considered failure
      throw new Error(`Non-2xx status: ${res.status}`);
    } catch (err: any) {
      d.attempts += 1;
      const delay = this.computeDelay(d.attempts);
      d.nextAttemptAt = Date.now() + delay;
      d.lastError = err?.message ?? String(err);
      await this.storage.updateDelivery(d);
    }
  }
}
