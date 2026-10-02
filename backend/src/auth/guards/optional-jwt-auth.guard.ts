import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attaches `req.user` when a valid access token is present, but NEVER rejects.
 *
 * Needed by the public endpoints (post detail, public profile, post list):
 * they must stay readable anonymously, yet should be able to personalise the
 * response with `likedByMe` / `isFollowing` for a signed-in visitor.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    // Swallow both "no token" and "invalid/expired token" — treat as anonymous.
    if (err || !user) return null as TUser;
    return user as TUser;
  }

  canActivate(context: ExecutionContext) {
    // Add the passport machinery to the request, then always allow through.
    const handler = super.canActivate(context);
    if (typeof handler === 'boolean') return true;
    if (handler instanceof Promise)
      return handler.then(() => true).catch(() => true);
    return true;
  }
}
