export interface User {
  id?: number;
  email: string;
  passwordHash: string;
  hasAcceptedTerms: boolean;
  termsAcceptedAt?: Date;
  isApproved: boolean;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id?: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface UserPreferences {
  id?: number;
  userId: number;
  theme: 'light' | 'dark' | 'system';
  updatedAt: Date;
}

export interface EnergyLog {
  id?: number;
  userId: number;
  date: string; // YYYY-MM-DD
  physical: number; // 1-10
  mental: number;   // 1-10
  emotional: number; // 1-10
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
