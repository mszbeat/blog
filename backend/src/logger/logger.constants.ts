/**
 * DI tokens for the logging layer.
 *
 * Kept as string tokens (not class references) so the raw `@silay/logger`
 * instances can be injected without leaking the package's types into every
 * consumer's constructor signature.
 */
export const SILAY_LOGGER = 'SILAY_LOGGER';
export const SILAY_AUDIT_LOGGER = 'SILAY_AUDIT_LOGGER';
