# keyvault: Learning Guide

![CWE-639](https://img.shields.io/badge/CWE--639-IDOR-red?style=flat-square)
![Node](https://img.shields.io/badge/Node-NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![Docker](https://img.shields.io/badge/Lab-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

**keyvault is an intentionally vulnerable application built for security education.** It contains a deliberate [IDOR / broken access control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
(CWE-639) flaw so you can practice finding and exploiting it in a safe and controlled environment.

<br>

> [!TIP]
> A guided, **non-spoiler** path to solving this lab. It teaches the *method*, not the answer — the exact winning request and the flag stay in [SOLUTION.md](SOLUTION.md).

<br>

## 🧬 What broken access control is

Here is the whole idea in one sentence:

> **Broken access control happens when an app checks _who you are_ but forgets
> to check _whether you're allowed to touch this particular thing_.**

Logging in answers "who are you?" — that's **authentication**. Deciding whether
*this* user may read *this* secret is a separate question — that's
**authorization**. This lab is an **IDOR** (Insecure Direct Object Reference):
the app takes an object id from the request and returns the object, never asking
whether it belongs to the caller.

The twist here is the id itself. In the first lab the ids were sequential
integers you could just count through. keyvault uses **random UUIDs** — the kind
of id developers reach for *believing it fixes IDOR*. It doesn't. A UUID is hard
to **guess**, but "hard to guess" is not "you're allowed." If the id ever leaks —
in a link, a log, a referrer header, a listing endpoint — and the server still
hands the object over without an ownership check, the bug is exactly as alive as
with `id=1,2,3`.

Think of a hotel that switched room numbers from `101, 102` to long random
codes. The master key still opens every door; the only thing that changed is you
now need to *see* the code written down somewhere instead of counting. The lock
was never installed either way.

> Want the deeper background — horizontal vs vertical escalation, why id format
> (sequential / UUID / base64 / hashids) is never the control, and the full
> workflow with **Burp Suite** and **OWASP ZAP**? Read the shared
> **[Broken Access Control field guide](https://github.com/iv0ks/appsec-labs/blob/main/docs/broken-access-control.md)**.
> This lab is a hands-on application of it.

<br>

## 🎓 What this level teaches

**Level 3 — the id is unguessable, and it still doesn't matter.** The secret
detail endpoint looks up a secret by its UUID and returns it with **no check
that it belongs to you**. Enumeration (the Level 1 technique) is off the table —
you can't brute-force a 122-bit random id. So the lesson is a different one:
**capture, don't guess.** Real apps leak ids constantly through secondary
channels; your job is to find one.

- **Entry point:** `GET /api/secrets/:id`
- **The broken defence:** the id is random, so the app assumes it's safe — being
  logged in is treated as enough.
- **What you can see legitimately:** your own secrets, via `GET /api/secrets`.
- **The target:** another user's secret, whose UUID is exposed somewhere you can
  reach.

## 🪧 How to approach it

1. Sign in as `alice` through your proxy and load the vault. Note your own
   secrets are addressed by long random UUIDs — no counting your way to anyone
   else's.
2. Open one of your own secrets by id and capture that request in your proxy.
   That's your **baseline**: `GET /api/secrets/<your-uuid>` returns your secret.
3. You can't guess a stranger's UUID — so hunt for one the app *gives* you.
   Look at every response the app sends. Is there an endpoint that lists activity
   or shares across the whole workspace? What fields does it include?
4. When you spot a UUID that isn't yours, drop it into the detail request you
   captured in step 2 and send it. Compare against your baseline.

## 🕵️‍♂️ Going further

Once you realise the read endpoint returns *any* valid UUID, the exposure is
every secret whose id ever leaks — and ids leak far more than people think:
server logs, `Referer` headers, analytics, shared links, error messages, other
API responses. Keep a second identity handy to prove that a secret owned by B is
readable while you're authenticated as A. That contrast is the proof of a broken
authorization check, independent of how "random" the id looks.

## 🤔 Why it matters

"Switch to UUIDs" is one of the most common *wrong* answers to IDOR. It raises
the cost of blind enumeration but does nothing about authorization, and it fails
completely the moment an id leaks — which, in real systems, is constantly.
Learning to treat the id format as irrelevant to the fix, and to hunt for leaked
identifiers as an attacker, is the core skill this level builds.

---

When you have captured the flag (or want to check the fix and the *why* behind
it), continue to **[SOLVE → SOLUTION.md](SOLUTION.md)**.

<br>

> **Legal / ethics.** This is an educational, deliberately vulnerable lab. Run it
> only locally, on owned, isolated infrastructure, and never use these techniques
> against systems without explicit written authorization.
