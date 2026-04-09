export interface GmailThread {
  id: string;
  subject: string;
  snippet: string;
  from: string;
  date: string;
  messageCount: number;
  labelIds: string[];
}

export interface Bucket {
  id: string;
  label: string;
  description: string;
  color: string;
  isCustom?: boolean;
}

export interface Classification {
  threadId: string;
  bucketId: string;
  confidence: number;
  reasoning: string;
}

export interface FeedbackEvent {
  threadId: string;
  predictedBucket: string;
  correctedBucket: string;
  confidence: number;
  timestamp: string;
}

export interface SessionData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
}
