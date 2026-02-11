export interface User {
  id?: number;
  email: string;
  passwordHash: string;
  hasAcceptedTerms: boolean;
  termsAcceptedAt?: Date;
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
