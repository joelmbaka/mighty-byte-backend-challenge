import path from 'path';
import { promises as fs } from 'fs';
import { DeliveryRecord } from './types';

export class Storage {
  private dataDir: string;
  private urlsPath: string;
  private deliveriesPath: string;

  private urls: Record<string, string> = {};
  private deliveries: DeliveryRecord[] = [];

  private writeQueue: Promise<void> = Promise.resolve();

  constructor(baseDir: string = process.cwd()) {
    this.dataDir = path.join(baseDir, 'data');
    this.urlsPath = path.join(this.dataDir, 'urls.json');
    this.deliveriesPath = path.join(this.dataDir, 'deliveries.json');
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });

    this.urls = await this.readJson<Record<string, string>>(this.urlsPath, {});
    this.deliveries = await this.readJson<DeliveryRecord[]>(this.deliveriesPath, []);
  }

  private async readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data) as T;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        await this.enqueueWrite(filePath, fallback);
        return fallback;
      }
      throw err;
    }
  }

  private async enqueueWrite(filePath: string, data: any) {
    const write = async () => {
      const tmp = `${filePath}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tmp, filePath);
    };
    // Chain writes to avoid concurrent file corruption
    this.writeQueue = this.writeQueue.then(write, write);
    return this.writeQueue;
  }

  async getUrl(code: string): Promise<string | null> {
    return this.urls[code] ?? null;
  }

  async setUrl(code: string, url: string): Promise<void> {
    this.urls[code] = url;
    await this.enqueueWrite(this.urlsPath, this.urls);
  }

  async getDueDeliveries(now: number): Promise<DeliveryRecord[]> {
    return this.deliveries.filter(d => !d.delivered && d.nextAttemptAt <= now);
  }

  async addDelivery(record: DeliveryRecord): Promise<void> {
    this.deliveries.push(record);
    await this.enqueueWrite(this.deliveriesPath, this.deliveries);
  }

  async updateDelivery(updated: DeliveryRecord): Promise<void> {
    const idx = this.deliveries.findIndex(d => d.id === updated.id);
    if (idx !== -1) {
      this.deliveries[idx] = updated;
      await this.enqueueWrite(this.deliveriesPath, this.deliveries);
    }
  }

  async markDelivered(id: string): Promise<void> {
    const idx = this.deliveries.findIndex(d => d.id === id);
    if (idx !== -1) {
      this.deliveries[idx].delivered = true;
      await this.enqueueWrite(this.deliveriesPath, this.deliveries);
    }
  }
}
