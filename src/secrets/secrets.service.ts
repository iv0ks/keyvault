// Secrets service — the data layer for the lab.
import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { secrets, users, type Secret } from '../db/schema.js';

@Injectable()
export class SecretsService {
  // SAFE: a user's own secrets, scoped to the session user. Full content is
  // fine here — they own these.
  async listOwn(userId: number) {
    return db
      .select({
        id: secrets.id,
        title: secrets.title,
        content: secrets.content,
        updatedAt: secrets.updatedAt,
      })
      .from(secrets)
      .where(eq(secrets.ownerId, userId))
      .orderBy(desc(secrets.updatedAt));
  }

  // ⚠️ THE LEAK (not the final bug, but the enabler).
  //
  // A "recent team activity" feed. It lists recent secrets across ALL users and
  // — the mistake — exposes each secret's UUID (`id`) and owner, just not the
  // body. The designers assumed the UUID was safe to show because it is
  // "unguessable". But showing it hands an attacker the exact id they can't
  // guess, which is all the vulnerable read endpoint needs.
  async activityFeed() {
    return db
      .select({
        id: secrets.id, // ← leaked identifier
        title: secrets.title,
        owner: users.username,
        updatedAt: secrets.updatedAt,
      })
      .from(secrets)
      .innerJoin(users, eq(secrets.ownerId, users.id))
      .orderBy(desc(secrets.updatedAt))
      .limit(20);
  }

  // ⚠️ THE VULNERABILITY.
  //
  // Fetches a secret by its UUID and returns it — with no check that it belongs
  // to the caller. The UUID being random changes nothing: authorization was
  // never about guessability. A correct implementation scopes the query to the
  // owner (see SOLUTION.md).
  async findById(id: string): Promise<Secret | undefined> {
    const [row] = await db.select().from(secrets).where(eq(secrets.id, id)).limit(1);
    return row;
  }
}
