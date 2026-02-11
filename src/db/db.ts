import Dexie, { type Table } from 'dexie';
import type {
  User,
  Session,
  UserPreferences,
  EnergyLog,
  UserProfile,
  SahhaProfile,
  SahhaScoreLog,
  SahhaBiomarkerLog,
} from './schema';

export class VectorDB extends Dexie {
  users!: Table<User>;
  sessions!: Table<Session>;
  userPreferences!: Table<UserPreferences>;
  energyLogs!: Table<EnergyLog>;
  userProfiles!: Table<UserProfile>;
  sahhaProfiles!: Table<SahhaProfile>;
  sahhaScores!: Table<SahhaScoreLog>;
  sahhaBiomarkers!: Table<SahhaBiomarkerLog>;

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
    this.version(4).stores({
      users: '++id, &email, isApproved',
      sessions: '++id, userId, expiresAt',
      userPreferences: '++id, userId',
      energyLogs: '++id, userId, date, [userId+date]',
      sahhaProfiles: '++id, &userId, externalId',
      sahhaScores: '++id, userId, type, scoreDateTime, [userId+type]',
      sahhaBiomarkers: '++id, userId, type, category, startDateTime, [userId+type]',
    });
    this.version(5).stores({
      users: '++id, &email, isApproved',
      sessions: '++id, userId, expiresAt',
      userPreferences: '++id, userId',
      energyLogs: '++id, userId, date, [userId+date]',
      userProfiles: '++id, &userId',
      sahhaProfiles: '++id, &userId, externalId',
      sahhaScores: '++id, userId, type, scoreDateTime, [userId+type]',
      sahhaBiomarkers: '++id, userId, type, category, startDateTime, [userId+type]',
    });
    this.version(6).stores({
      users: '++id, &email, isApproved',
      sessions: '++id, userId, expiresAt',
      userPreferences: '++id, userId',
      energyLogs: '++id, userId, date, [userId+date]',
      userProfiles: '++id, &userId',
      sahhaProfiles: '++id, &userId, externalId',
      sahhaScores: '++id, userId, type, scoreDateTime, [userId+type]',
      sahhaBiomarkers: '++id, userId, type, category, startDateTime, [userId+type]',
    }).upgrade(tx => {
      return tx.table('userProfiles').toCollection().modify(profile => {
        if (profile.weeklyWorkHours != null && profile.dailyWorkHours == null) {
          profile.dailyWorkHours = Math.round((profile.weeklyWorkHours / 5) * 10) / 10;
        }
      });
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
