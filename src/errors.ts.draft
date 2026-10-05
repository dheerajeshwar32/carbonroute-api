/**
 * Typed application errors. The HTTP error handler maps these to status codes
 * via `instanceof` — never by matching on error message text.
 */
export class AppError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details?: unknown
    ) {
        super(message);
        this.name = new.target.name;
    }
}

/** 400 — the request payload failed validation. */
export class ValidationError extends AppError {
    constructor(message: string, details?: unknown) {
        super(400, 'invalid_request', message, details);
    }
}

/** 422 — the request is valid, but no region can satisfy its SLA. */
export class SLAViolationError extends AppError {
    constructor(message: string, details?: unknown) {
        super(422, 'sla_unsatisfiable', message, details);
    }
}

/** 502 — the upstream model provider failed after all failover attempts. */
export class UpstreamError extends AppError {
    constructor(message: string, details?: unknown) {
        super(502, 'upstream_error', message, details);
    }
}

/** 503 — a required dependency is not configured or not ready. */
export class ServiceUnavailableError extends AppError {
    constructor(message: string, details?: unknown) {
        super(503, 'service_unavailable', message, details);
    }
}
