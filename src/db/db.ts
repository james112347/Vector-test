import Dexie, { type Table } from 'dexie';
import type { User, Session, UserPreferences } from './schema';

export class VectorDB extends Dexie {
  users!: Table<User>;
  sessions!: Table<Session>;
  userPreferences!: Table<UserPreferences>;

  constructor() {
    super('VectorDB');
    this.version(1).stores({
      users: '++id, &email',
      sessions: '++id, userId, expiresAt',
      userPreferences: '++id, userId',
    });
  }
}

export const db = new VectorDB();

// Request persistent storage to prevent browser eviction
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().then((persistent) => {
    if (persistent) {
      console.log('Storage will not be cleared except by explicit user action');
    } else {
      console.log('Storage may be cleared by the UA under storage pressure');
    }
  });
}
