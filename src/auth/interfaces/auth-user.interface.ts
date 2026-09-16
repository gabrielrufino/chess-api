import { Request } from 'express';

export interface AuthUser {
  sub: string;
  isGuest: boolean;
  iat: number;
  exp?: number;
}

export type AuthRequest = Request & { user: AuthUser };
