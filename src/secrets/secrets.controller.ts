// Secrets controller.
//
// The intentional vulnerability lives in `GET /api/secrets/:id`: it looks up a
// secret by its UUID and returns it WITHOUT checking that the secret belongs to
// the logged-in user (a read IDOR, CWE-639). The twist versus level 1
// (ledgerly) is the id format: a random UUID, not a sequential integer. You
// cannot enumerate it — but `GET /api/activity` leaks other users' UUIDs, so
// you capture the victim's id there and feed it straight to the read endpoint.
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, type SessionData } from './auth.guard.js';
import { SecretsService } from './secrets.service.js';

@Controller('api')
@UseGuards(AuthGuard)
export class SecretsController {
  constructor(private readonly secrets: SecretsService) {}

  // SAFE: only your own secrets.
  @Get('secrets')
  async listOwn(@Req() req: Request & { session: SessionData }) {
    const rows = await this.secrets.listOwn(req.session.userId!);
    return { secrets: rows };
  }

  // ⚠️ LEAK: recent activity across all users, exposing each secret's UUID.
  @Get('activity')
  async activity() {
    const rows = await this.secrets.activityFeed();
    return { activity: rows };
  }

  // ⚠️ VULNERABLE: fetches by UUID with no ownership check.
  //
  // ParseUUIDPipe validates the id is a well-formed UUID (so this isn't about
  // malformed input) — and then the handler returns whatever it finds, no
  // matter who owns it.
  @Get('secrets/:id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const secret = await this.secrets.findById(id);
    if (!secret) throw new NotFoundException('secret not found');
    return { secret };
  }
}
