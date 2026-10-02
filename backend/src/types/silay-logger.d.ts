/**
 * Ambient type declarations for `@silay/logger` v1.0.1.
 *
 * The package ships plain ESM JavaScript with JSDoc only — no `.d.ts` files —
 * so without this module TypeScript would type every import as `any`
 * (`noImplicitAny` is off in tsconfig.json, which is why it compiles silently).
 * These declarations restore real type safety across the logging layer.
 *
 * Verified against the published source:
 *   node_modules/@silay/logger/src/index.js
 *   node_modules/@silay/logger/src/config/LoggerConfig.js
 *   node_modules/@silay/logger/src/core/Logger.js
 */
declare module '@silay/logger' {
  export type LevelName =
    | 'trace'
    | 'debug'
    | 'info'
    | 'http'
    | 'warn'
    | 'error'
    | 'fatal';

  export type LogLevel = LevelName | 'silent';
  export type LogFormat = 'json' | 'pretty';
  export type EnvironmentName =
    | 'development'
    | 'test'
    | 'staging'
    | 'production';

  /** Arbitrary structured fields attached to a single log entry. */
  export type LogFields = Record<string, unknown>;

  export interface LogEntryData {
    level: LevelName;
    message: string;
    timestamp: string;
    service: string;
    environment: string;
    version: string;
    [key: string]: unknown;
  }

  export interface Formatter {
    format(entry: LogEntryData): string;
  }

  export interface TransportOptions {
    level?: LogLevel;
    formatter?: Formatter;
  }

  export class Transport {
    constructor(options?: TransportOptions);
    write(entry: LogEntryData): void;
    flush(): Promise<void>;
    close(): Promise<void>;
  }

  export class ConsoleTransport extends Transport {
    constructor(options?: TransportOptions);
  }

  export interface FileTransportOptions extends TransportOptions {
    filename: string;
    maxBytes?: number;
    maxFiles?: number;
    retentionDays?: number;
    compress?: boolean;
  }

  export class FileTransport extends Transport {
    constructor(options: FileTransportOptions);
  }

  export class JsonFormatter implements Formatter {
    format(entry: LogEntryData): string;
  }

  export class PrettyFormatter implements Formatter {
    constructor(options?: { colors?: boolean });
    format(entry: LogEntryData): string;
  }

  export interface FileLoggerOptions {
    directory?: string;
    maxSize?: string | number;
    maxFiles?: number;
    retentionDays?: number;
    compress?: boolean;
  }

  export interface SamplingOptions {
    enabled: boolean;
    trace?: number;
    debug?: number;
    info?: number;
    http?: number;
    warn?: number;
    error?: number;
    fatal?: number;
  }

  export interface DeduplicationOptions {
    enabled: boolean;
    windowMs?: number;
  }

  export interface UserLoggerOptions {
    service?: string;
    environment?: EnvironmentName | string;
    version?: string;
    level?: LogLevel;
    format?: LogFormat;
    transports?: Array<'console' | 'file' | Transport>;
    file?: FileLoggerOptions;
    /** Key names (matched anywhere, case/separator-insensitive) or dotted paths. */
    redact?: string[];
    sampling?: SamplingOptions;
    deduplication?: DeduplicationOptions;
    prettyColors?: boolean;
    /**
     * Registers SIGTERM/SIGINT/uncaughtException/unhandledRejection handlers
     * that call `process.exit()`. Disable in NestJS — the framework owns the
     * shutdown lifecycle — and flush via `onApplicationShutdown` instead.
     */
    handleProcessSignals?: boolean;
  }

  export class Logger {
    child(fields: LogFields): Logger;
    /** Patches the ambient AsyncLocalStorage context. Returns false if no scope is active. */
    setContext(fields: LogFields): boolean;
    withContext<T>(fields: LogFields, fn: () => T): T;
    trace(message: string, fields?: LogFields): void;
    debug(message: string, fields?: LogFields): void;
    info(message: string, fields?: LogFields): void;
    http(message: string, fields?: LogFields): void;
    warn(message: string, fields?: LogFields): void;
    error(message: string, fieldsOrError?: (LogFields & { error?: unknown }) | unknown): void;
    fatal(message: string, fieldsOrError?: (LogFields & { error?: unknown }) | unknown): void;
    addTransport(transport: Transport): void;
    flush(): Promise<void>;
    close(): Promise<void>;
  }

  export interface AuditEvent {
    action: string;
    entity: string;
    entityId?: string;
    actorId?: string;
    actorType?: string;
    before?: unknown;
    after?: unknown;
    ip?: string;
    userAgent?: string;
    metadata?: LogFields;
  }

  export class AuditLogger {
    /**
     * The dedicated child Logger backing this audit trail. Exposed (not private)
     * in the implementation, so hosts can flush/close its own engine and
     * `audit.log` FileTransport on shutdown.
     */
    readonly logger: Logger;
    record(event: AuditEvent): void;
  }

  export function createLogger(options?: UserLoggerOptions): Logger;
  export function createAuditLogger(options?: UserLoggerOptions): AuditLogger;

  export const RequestContext: {
    KNOWN_CONTEXT_FIELDS: readonly string[];
    withContext<T>(seed: LogFields | undefined, fn: () => T): T;
    getContext(): LogFields;
    setContext(patch: LogFields): boolean;
    generateId(prefix?: string): string;
  };

  export interface RequestLoggerOptions {
    /** Honour an incoming `x-request-id` header. Keep false for public traffic. */
    trustProxy?: boolean;
    /** Extra non-sensitive header names to record. */
    headers?: string[];
    skip?: (req: unknown) => boolean;
  }

  export function requestLogger(logger: Logger, options?: RequestLoggerOptions): any;
  export function errorLogger(logger: Logger): any;

  export function attachRedisLogging(
    redisClient: any,
    logger: Logger,
    options?: { enabled?: boolean },
  ): any;

  export function attachMongoLogging(
    mongoClient: any,
    logger: Logger,
    options?: { enabled?: boolean },
  ): void;

  export class LoggerError extends Error {
    code?: string;
    constructor(message: string, options?: { cause?: unknown; code?: string });
  }
  export class LoggerConfigError extends LoggerError {}
  export class TransportError extends LoggerError {}

  export const ErrorClassification: Readonly<Record<string, string>>;

  export class ClassifiedError extends Error {
    code?: string;
    statusCode?: number;
    classification: string;
    isOperational?: boolean;
    constructor(
      message: string,
      options: {
        cause?: unknown;
        code?: string;
        statusCode?: number;
        classification: string;
        isOperational?: boolean;
      },
    );
  }
  export class ValidationError extends ClassifiedError {}
  export class DatabaseError extends ClassifiedError {}
  export class NetworkError extends ClassifiedError {}
  export class SecurityError extends ClassifiedError {}
  export class InfrastructureError extends ClassifiedError {}
}
