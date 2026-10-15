import { prisma, type Prisma, type UserToken, type UserTokenPurpose } from "@smartbusiness/database";
import { generateOpaqueToken, hashOpaqueToken, looksLikeOpaqueToken } from "../utils/opaque-token.js";

// ═══════════════════════════════════════════════════════════════
// ONE-TIME TOKENS FOR EMAIL LINKS (password reset, invitation)
//
// Life cycle:  ACTIVE ──consume()──► USED
//                │
//                ├── newer token issued / invitation cancelled ──► REVOKED
//                └── time passes ──► EXPIRED (derived from expiresAt, never stored)
//
// Only ACTIVE tokens work. Every check includes the purpose, so a reset token can
// never be replayed as an invitation (or the reverse).
//
// Methods return a result instead of throwing HTTP errors: each app decides how to
// word EXPIRED or USED for its own users.
// ═══════════════════════════════════════════════════════════════

type Db = typeof prisma | Prisma.TransactionClient;

export type TokenProblem = "NOT_FOUND" | "EXPIRED" | "USED" | "REVOKED";

export type TokenCheck =
  | { ok: true; record: UserToken }
  | { ok: false; problem: TokenProblem };

export interface IssueTokenInput {
  userId: string;
  purpose: UserTokenPurpose;
  ttlMs: number;
  // Invitations: the company, workspace and person who sent it
  tenantId?: string;
  workspaceId?: string;
  createdById?: string;
}

export class UserTokenService {
  constructor(
    private readonly db: typeof prisma = prisma,
    // Injectable clock, so tests can check expiry without waiting
    private readonly now: () => Date = () => new Date(),
  ) {}

  // Creates a token and revokes older active tokens in the same scope: same user and
  // purpose, and for invitations the same workspace (being invited to two workspaces
  // at once must not cancel the first invitation). Returns the raw token, which is
  // shown exactly once (in the email); only its fingerprint is stored.
  // Pass `tx` to make this part of a larger transaction.
  async issue(input: IssueTokenInput, tx?: Db): Promise<{ token: string; record: UserToken }> {
    const run = async (db: Db) => {
      const now = this.now();
      await db.userToken.updateMany({
        where: {
          userId: input.userId,
          purpose: input.purpose,
          workspaceId: input.workspaceId ?? null,
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      const { raw, hash } = generateOpaqueToken();
      const record = await db.userToken.create({
        data: {
          userId: input.userId,
          purpose: input.purpose,
          tokenHash: hash,
          expiresAt: new Date(now.getTime() + input.ttlMs),
          tenantId: input.tenantId ?? null,
          workspaceId: input.workspaceId ?? null,
          createdById: input.createdById ?? null,
        },
      });
      return { token: raw, record };
    };

    return tx ? run(tx) : this.db.$transaction(run);
  }

  // Read-only check: is this token currently usable for this purpose, and if not, why?
  // Used to show an invitation before it is accepted, and to explain a failed consume().
  async inspect(token: unknown, purpose: UserTokenPurpose, tx?: Db): Promise<TokenCheck> {
    if (!looksLikeOpaqueToken(token)) return { ok: false, problem: "NOT_FOUND" };

    const record = await (tx ?? this.db).userToken.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
    });

    // A token for another purpose is reported as not found: never confirm it exists.
    if (!record || record.purpose !== purpose) return { ok: false, problem: "NOT_FOUND" };
    if (record.usedAt) return { ok: false, problem: "USED" };
    if (record.revokedAt) return { ok: false, problem: "REVOKED" };
    if (record.expiresAt <= this.now()) return { ok: false, problem: "EXPIRED" };
    return { ok: true, record };
  }

  // Marks the token used, exactly once. The conditions are part of the UPDATE, so when
  // two requests consume the same token at the same moment, the database lets only one
  // of them match; the other gets USED. Pass `tx` so the password change (or invitation
  // acceptance) and the consumption commit together or not at all.
  async consume(token: unknown, purpose: UserTokenPurpose, tx?: Db): Promise<TokenCheck> {
    if (!looksLikeOpaqueToken(token)) return { ok: false, problem: "NOT_FOUND" };

    const db = tx ?? this.db;
    const tokenHash = hashOpaqueToken(token);
    const now = this.now();

    const { count } = await db.userToken.updateMany({
      where: { tokenHash, purpose, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });

    if (count === 1) {
      return { ok: true, record: await db.userToken.findUniqueOrThrow({ where: { tokenHash } }) };
    }

    const why = await this.inspect(token, purpose, tx);
    // If it looks usable now, another request consumed it in between: report USED.
    return why.ok ? { ok: false, problem: "USED" } : why;
  }

  // Revokes every active token of this purpose for the user (optionally only for one
  // workspace), e.g. when an invited member is removed before accepting.
  async revokeForUser(
    userId: string,
    purpose: UserTokenPurpose,
    scope: { workspaceId?: string } = {},
    tx?: Db,
  ): Promise<number> {
    const { count } = await (tx ?? this.db).userToken.updateMany({
      where: {
        userId,
        purpose,
        ...(scope.workspaceId !== undefined && { workspaceId: scope.workspaceId }),
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: this.now() },
    });
    return count;
  }
}
