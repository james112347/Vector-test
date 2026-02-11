import Dexie, { type Table } from 'dexie';
import type { User, Session, UserPreferences, EnergyLog } from './schema';

export class VectorDB extends Dexie {
  users!: Table<User>;
  sessions!: Table<Session>;
  userPreferences!: Table<UserPreferences>;
  energyLogs!: Table<EnergyLog>;

  constructor() {
    super('VectorDB');
    this.version(1).stores({
      users: '++id, &email',
      sessions: '++id, userId, expiresAt',
      userPreferences: '++id, userId',
    });
    this.version(2).stores({
      users: '++id, &email, isApproved',
      sessions: '++id, userId, expiresAt',
      userPreferences: '++id, userId',
    }).upgrade(tx => {
      return tx.table('users').toCollection().modify(user => {
        if (user.isApproved === undefined) user.isApproved = true;
        if (user.isAdmin === undefined) user.isAdmin = false;
      });
    });
    this.version(3).stores({
      users: '++id, &email, isApproved',
      sessions: '++id, userId, expiresAt',
      userPreferences: '++id, userId',
      energyLogs: '++id, userId, date, [userId+date]',
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
