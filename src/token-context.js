import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

export function runWithNotionToken(token, callback) {
  return storage.run({ notionToken: token }, callback);
}

export function getRequestNotionToken() {
  return storage.getStore()?.notionToken;
}
