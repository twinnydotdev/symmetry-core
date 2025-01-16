import { ServerMessageKey } from "./types";

export function safeParseJson<T>(data: string): T | undefined {
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    return undefined;
  }
}

export function createMessage<T>(key: ServerMessageKey, data?: T): string {
  return JSON.stringify({ key, data });
}
