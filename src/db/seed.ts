// Seed script — idempotent.
//
// Three identities make the lab work:
//   - alice (id 1): you, a low-privilege member. Credentials alice/password123.
//   - bob   (id 2): the victim. One of his secrets carries the FLAG.
//   - carol (id 3): bystander, keeps the activity feed realistic.
//
// Secret ids are **fixed UUIDs** so the lab is reproducible and SOLUTION.md can
// cite bob's exact id. In a real app these would be random; the point is that
// randomness is not authorization. alice can only list her OWN secrets, but the
// activity feed leaks the UUIDs of everyone's recent secrets — that's how she
// learns bob's id without guessing it.
import { eq } from 'drizzle-orm';
import { db, sql } from './client.js';
import { users, secrets } from './schema.js';
import { hashPassword } from '../auth.js';
import { config } from '../config.js';

const seedUsers = [
  { id: 1, username: 'alice', password: 'password123', displayName: 'Alice Martins' },
  { id: 2, username: 'bob', password: 'correct-horse-battery-staple', displayName: 'Bob Keller' },
  { id: 3, username: 'carol', password: 'hunter2hunter2', displayName: 'Carol Nwosu' },
];

type SeedSecret = {
  id: string;
  ownerId: number;
  title: string;
  content: string;
  updatedAt: Date;
};

// Deterministic UUIDs. bob's "Production root credentials" holds the flag.
const seedSecrets: SeedSecret[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    ownerId: 1,
    title: 'Personal email backup codes',
    content: 'backup: 4821 9930 1177',
    updatedAt: new Date('2026-11-10T09:00:00Z'),
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    ownerId: 1,
    title: 'Wifi password',
    content: 'home-wifi: tulip-garden-19',
    updatedAt: new Date('2026-11-11T18:30:00Z'),
  },
  {
    // bob's secret — the target. Its UUID leaks via the activity feed.
    id: 'b0bb0b00-0000-4000-8000-00000000b0b5',
    ownerId: 2,
    title: 'Production root credentials',
    content: `root password rotated monthly. ${config.flag}`,
    updatedAt: new Date('2026-11-12T14:05:00Z'),
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    ownerId: 3,
    title: 'Draft announcement',
    content: 'carol: ship the newsletter friday',
    updatedAt: new Date('2026-11-12T08:15:00Z'),
  },
];

async function main(): Promise<void> {
  console.log('[seed] seeding users …');
  for (const u of seedUsers) {
    await db
      .insert(users)
      .values({
        id: u.id,
        username: u.username,
        passwordHash: hashPassword(u.password),
        displayName: u.displayName,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: u.username,
          passwordHash: hashPassword(u.password),
          displayName: u.displayName,
        },
      });
  }

  console.log('[seed] seeding secrets …');
  for (const s of seedSecrets) {
    await db
      .insert(secrets)
      .values(s)
      .onConflictDoUpdate({
        target: secrets.id,
        set: { ownerId: s.ownerId, title: s.title, content: s.content, updatedAt: s.updatedAt },
      });
  }

  const [bobSecret] = await db.select().from(secrets).where(eq(secrets.ownerId, 2)).limit(1);
  console.log(
    `[seed] done. users: alice, bob, carol. flag seeded on bob's secret (id ${bobSecret?.id}).`,
  );
  await sql.end();
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
