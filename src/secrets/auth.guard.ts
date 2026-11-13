// Session auth guard.
//
// Every secrets route requires a logged-in session. The guard only checks that
// *a* session exists — it says nothing about *which* secrets you may read. That
// is authentication, not authorization; the missing ownership check on the read
// endpoint is the lab.
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export interface SessionData {
  userId?: number;
  username?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { session: SessionData }>();
    if (!req.session?.userId) {
      throw new UnauthorizedException('Not authenticated. POST /api/login first.');
    }
    return true;
  }
}
