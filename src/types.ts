export interface UrlMapping {
  code: string;
  url: string;
  createdAt: number;
}

export interface DeliveryPayload {
  shortenedURL: string;
}

export interface DeliveryRecord {
  id: string;
  callbackUrl: string;
  payload: DeliveryPayload;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  lastError?: string;
  delivered: boolean;
}
