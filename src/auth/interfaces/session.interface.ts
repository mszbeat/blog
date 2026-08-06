export interface SessionInterface {
  userId: string;
  ip?: string;
  refreshToken: string;
  createdAt: Date;
  userAgent?: string;
}