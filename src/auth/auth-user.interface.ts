export interface AuthUser {
  sub: string;
  name: string;
  isGuest: boolean;
  iat: number;
}
