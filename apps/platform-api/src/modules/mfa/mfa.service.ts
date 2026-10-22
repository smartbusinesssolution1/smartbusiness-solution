import { randomInt } from "crypto";
import { AuthError, type PasswordService, type TokenService } from "@smartbusiness/auth";
import { AppError, ConflictError, MfaLockedError, ValidationError } from "../../shared/errors/index.js";
import type { AuditService } from "../../shared/services/audit.service.js";
import type { SecretBox } from "../../shared/services/secret-box.js";
import { logger } from "../../shared/services/logger.js";
import { clearAttempts, lockedUntil, reserveAttempt } from "../auth/attempts.js";
import type { MfaRepository } from "./mfa.repository.js";
import { generateSecret, matchingStep, otpauthUrl } from "./totp.js";

// ═══════════════════════════════════════════════════════════════
// TWO-FACTOR SIGN-IN
//
// Sign-in itself is unchanged (password only), so products that don't require two-factor
// (Clock-In) are unaffected. A product that does (Check Printing, for its admins) refuses
// a session whose access token lacks "otp"; the person then enters a code here, which
// marks THIS session verified and re-issues the access token with amr ["pwd", "otp"].
//
//   setup:   start → secret shown once (QR) → confirm with a code → on, + 10 backup codes
//   verify:  6-digit code (or a backup code) → this session verified
//   off:     password + code → secret, backup codes and verified sessions cleared
// ═══════════════════════════════════════════════════════════════

const BACKUP_CODE_COUNT = 10;
// No 0/O, 1/I/L: backup codes are read off paper and typed by hand.
const BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// A setup left half-done (QR shown, never confirmed) can't be confirmed after this.
const SETUP_TTL_MS = 15 * 60 * 1000;

type Attempted = { count: number; lockedNow: boolean };

export interface MfaContext {
  userId: string;
  refreshTokenHash: string | null;
  ipAddress?: string;
}

export class MfaService {
  constructor(
    private readonly repo: MfaRepository,
    private readonly box: SecretBox,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ─── Status ───────────────────────────────────────────────

  async status(ctx: MfaContext) {
    const user = await this.user(ctx.userId);
    const session = ctx.refreshTokenHash ? await this.repo.findSession(ctx.refreshTokenHash, ctx.userId) : null;
    return {
      enabled: Boolean(user.mfaEnabledAt),
      enabledAt: user.mfaEnabledAt,
      backupCodesRemaining: user.mfaEnabledAt ? await this.repo.unusedBackupCodes(user.id) : 0,
      verifiedThisSession: Boolean(session?.mfaVerifiedAt),
    };
  }

  // ─── Setup ────────────────────────────────────────────────

  // A new secret, kept pending until a code proves the phone has it. Shown exactly once:
  // as a QR code (otpauth link) and as text, for typing in by hand.
  async startSetup(ctx: MfaContext) {
    const user = await this.user(ctx.userId);
    if (user.mfaEnabledAt) throw new ConflictError("Two-factor sign-in is already on. Turn it off first to set it up again.");
    const secret = generateSecret();
    await this.repo.savePendingSecret(user.id, this.box.seal(secret));
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  async confirmSetup(ctx: MfaContext, code: string) {
    const user = await this.user(ctx.userId);
    if (user.mfaEnabledAt) throw new ConflictError("Two-factor sign-in is already on.");
    if (!user.mfaPendingSecretEncrypted || !user.mfaPendingCreatedAt || this.now().getTime() - user.mfaPendingCreatedAt.getTime() > SETUP_TTL_MS) {
      throw new AppError("This setup has expired. Start again to get a new QR code.", 400, "MFA_SETUP_EXPIRED");
    }
    const session = await this.session(ctx);

    const attempt = await this.reserve(user.id);
    const step = matchingStep(this.box.open(user.mfaPendingSecretEncrypted), code.trim(), this.now().getTime());
    if (step === null) await this.wrongCode(user, ctx, attempt, "setup");

    const backupCodes = newBackupCodes();
    await this.repo.enable(user.id, step!, backupCodes.map((c) => this.box.fingerprint(normalise(c))), session.id);
    await this.record(user, ctx, "MFA_ENABLED", {});
    return { backupCodes, accessToken: this.verifiedToken(user) };
  }

  // ─── Verify (once per session) ────────────────────────────

  async verify(ctx: MfaContext, input: string) {
    const user = await this.user(ctx.userId);
    if (!user.mfaEnabledAt || !user.mfaSecretEncrypted) {
      throw new AppError("Two-factor sign-in isn't set up for this account yet.", 409, "MFA_NOT_SET_UP");
    }
    const session = await this.session(ctx);

    // Counted before the code is checked: the same atomic reservation as passwords.
    const attempt = await this.reserve(user.id);

    const typed = input.trim();
    let usedBackupCode = false;
    if (/^\d{6}$/.test(typed)) {
      const step = matchingStep(this.box.open(user.mfaSecretEncrypted), typed, this.now().getTime());
      // A right code that was already used (replay, or a second tab) is refused like a wrong one.
      if (step === null || !(await this.repo.claimStep(user.id, step))) await this.wrongCode(user, ctx, attempt, "sign-in");
    } else {
      if (!(await this.repo.useBackupCode(user.id, this.box.fingerprint(normalise(typed))))) await this.wrongCode(user, ctx, attempt, "sign-in");
      usedBackupCode = true;
    }

    await clearAttempts(user.id, "code");
    await this.repo.markSessionVerified(session.id);
    const remaining = usedBackupCode ? await this.repo.unusedBackupCodes(user.id) : undefined;
    await this.record(user, ctx, usedBackupCode ? "MFA_BACKUP_CODE_USED" : "MFA_VERIFIED", usedBackupCode ? { backupCodesRemaining: remaining } : {});
    return { accessToken: this.verifiedToken(user), backupCodesRemaining: remaining };
  }

  // ─── Backup codes and turning off ─────────────────────────

  // New backup codes replace all old ones; needs a current code from the app.
  async regenerateBackupCodes(ctx: MfaContext, code: string) {
    const user = await this.user(ctx.userId);
    if (!user.mfaEnabledAt || !user.mfaSecretEncrypted) throw new AppError("Two-factor sign-in isn't on.", 409, "MFA_NOT_SET_UP");
    const attempt = await this.reserve(user.id);
    const step = matchingStep(this.box.open(user.mfaSecretEncrypted), code.trim(), this.now().getTime());
    if (step === null || !(await this.repo.claimStep(user.id, step))) await this.wrongCode(user, ctx, attempt, "new backup codes");
    await clearAttempts(user.id, "code");

    const backupCodes = newBackupCodes();
    await this.repo.replaceBackupCodes(user.id, backupCodes.map((c) => this.box.fingerprint(normalise(c))));
    await this.record(user, ctx, "MFA_BACKUP_CODES_REGENERATED", {});
    return { backupCodes };
  }

  // Off: needs the password AND a code (or backup code), so a borrowed unlocked laptop
  // isn't enough. Check Printing still requires it for admins: they'll set it up again.
  async disable(ctx: MfaContext, password: string, code: string) {
    const user = await this.user(ctx.userId);
    if (!user.mfaEnabledAt || !user.mfaSecretEncrypted) throw new AppError("Two-factor sign-in isn't on.", 409, "MFA_NOT_SET_UP");
    if (!user.passwordHash || !(await this.passwords.verify(password, user.passwordHash))) {
      throw new ValidationError("Validation failed", { password: ["That password isn't right."] });
    }
    const attempt = await this.reserve(user.id);
    const typed = code.trim();
    const ok = /^\d{6}$/.test(typed)
      ? await this.claimIfMatches(user.id, user.mfaSecretEncrypted, typed)
      : await this.repo.useBackupCode(user.id, this.box.fingerprint(normalise(typed)));
    if (!ok) await this.wrongCode(user, ctx, attempt, "turning off");

    await this.repo.disable(user.id);
    await this.record(user, ctx, "MFA_DISABLED", {});
    // This session no longer counts as verified either.
    return { accessToken: this.tokens.generateAccessToken({ userId: user.id, email: user.email, amr: ["pwd"] }) };
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async user(userId: string) {
    const user = await this.repo.findUser(userId);
    if (!user) throw new AuthError("Account not found or deactivated.");
    return user;
  }

  private async session(ctx: MfaContext) {
    const session = ctx.refreshTokenHash ? await this.repo.findSession(ctx.refreshTokenHash, ctx.userId) : null;
    if (!session) throw new AuthError("Your session has ended. Sign in again.");
    return session;
  }

  // Returns this request's attempt. Kept in the caller's variables, never on the service:
  // one service instance serves every request at once.
  private async reserve(userId: string): Promise<Attempted> {
    const attempt = await reserveAttempt(userId, "code");
    if (!attempt.allowed) {
      logger.warn({ userId }, "Two-factor code refused: too many wrong codes");
      throw new MfaLockedError((await lockedUntil(userId, "code")) ?? new Date(Date.now() + 60_000));
    }
    return attempt;
  }

  private async claimIfMatches(userId: string, sealedSecret: string, code: string): Promise<boolean> {
    const step = matchingStep(this.box.open(sealedSecret), code, this.now().getTime());
    return step !== null && (await this.repo.claimStep(userId, step));
  }

  // A wrong code: audited with its attempt number; the 5th, 10th… locks (audited once).
  private async wrongCode(
    user: { id: string; tenantMembers: Array<{ tenantId: string }> },
    ctx: MfaContext,
    attempt: Attempted,
    during: string,
  ): Promise<never> {
    await this.record(user, ctx, "MFA_FAILED", { during, attempt: attempt.count });
    if (attempt.lockedNow) {
      const until = (await lockedUntil(user.id, "code")) ?? new Date(Date.now() + 60_000);
      await this.record(user, ctx, "MFA_LOCKED", {
        failedAttempts: attempt.count,
        lockedForMinutes: Math.round((until.getTime() - Date.now()) / 60_000),
        lockedUntil: until.toISOString(),
      });
      throw new MfaLockedError(until);
    }
    throw new ValidationError("Validation failed", { code: ["That code isn't right. Check your authenticator app and try again."] });
  }

  private verifiedToken(user: { id: string; email: string }): string {
    return this.tokens.generateAccessToken({ userId: user.id, email: user.email, amr: ["pwd", "otp"] });
  }

  private async record(user: { id: string; tenantMembers: Array<{ tenantId: string }> }, ctx: MfaContext, action: string, details: Record<string, unknown>) {
    const tenantId = user.tenantMembers[0]?.tenantId;
    if (!tenantId) return;
    await this.audit.log({ tenantId, userId: user.id, action, entityType: "User", entityId: user.id, details, ipAddress: ctx.ipAddress });
  }
}

// "K7QPM-X3TNB": 10 characters from a 31-letter alphabet (about 50 bits), shown with a
// dash for reading; stored only as a keyed fingerprint.
function newBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const chars = Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join("");
    return `${chars.slice(0, 5)}-${chars.slice(5)}`;
  });
}

// What people type: any case, with or without the dash or spaces.
function normalise(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, "");
}
