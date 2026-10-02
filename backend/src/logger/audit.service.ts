import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createAuditLogger, type AuditLogger } from '@silay/logger';
import { buildLoggerOptions } from './logger.config';

/** Field names captured from the request when recording an audit event. */
export interface ActorContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Compliance-grade audit trail, backed by `@silay/logger`'s dedicated
 * `AuditLogger`.
 *
 * This is intentionally a *separate* concern from operational logging:
 * audit records answer "who did what to which entity, and when", are never
 * sampled or level-filtered (an audit log silenced by a log-level threshold is
 * a compliance gap), and are written to their own `logs/audit.log` so they can
 * be retained and access-controlled independently of `app.log`.
 *
 * Every security-relevant mutation in this API records here: authentication
 * events, account and role changes, and content create/update/delete.
 */
@Injectable()
export class AuditService implements OnApplicationShutdown {
  private readonly audit: AuditLogger;

  constructor(config: ConfigService) {
    // The audit logger manages its own file transport; keep it on the same
    // console sink as the app logger so `npm run start:dev` shows one stream.
    this.audit = createAuditLogger(
      buildLoggerOptions(config, {
        service: `${config.get<string>('SERVICE_NAME') ?? 'blog-api'}-audit`,
        // createAuditLogger() always appends its own FileTransport for
        // logs/audit.log. Leaving "file" in the base transports would open a
        // SECOND writer on logs/app.log alongside AppLoggerService's — two
        // independent rotation counters racing on one file. Console only here;
        // the durable audit record is audit.log.
        transports: ['console'],
      }),
    );
  }

  /**
   * Records one audit event.
   *
   * `before` / `after` are passed through the package's recursive redactor, so
   * it is safe to hand it whole entities — password/token/secret fields are
   * replaced with `[REDACTED]` before anything reaches disk.
   */
  record(event: {
    action: string;
    entity: string;
    entityId?: string;
    actorId?: string;
    actorType?: 'user' | 'admin' | 'system' | 'anonymous';
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }): void {
    try {
      this.audit.record(event);
    } catch {
      // An audit sink failure must never take down the request that triggered it.
    }
  }

  /** Convenience wrapper for authentication events (login, logout, refresh…). */
  auth(
    action: string,
    actor: { id?: string; email?: string; role?: string },
    ctx: ActorContext = {},
    metadata: Record<string, unknown> = {},
  ): void {
    this.record({
      action,
      entity: 'auth',
      entityId: actor.id,
      actorId: actor.id,
      actorType: actor.role === 'admin' ? 'admin' : actor.id ? 'user' : 'anonymous',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      metadata: { email: actor.email, role: actor.role, ...metadata },
    });
  }

  /**
   * The audit logger owns its own engine and its own `audit.log` FileTransport,
   * so it must be flushed independently of AppLoggerService — otherwise the
   * last few audit records (often the most interesting ones, written right
   * before a crash or deploy) are still sitting in the transport's write queue
   * when the process exits.
   */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.audit.logger.flush();
      await this.audit.logger.close();
    } catch {
      // Shutdown must not fail because a log sink did.
    }
  }
}
