import { Request } from 'express';

export interface AuthUser {
  sub: string;
  name: string;
  isGuest: boolean;
  iat: number;
}

export type AuthRequest = Request & { user: AuthUser };
