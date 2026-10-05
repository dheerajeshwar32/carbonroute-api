import pino, { Logger } from 'pino';

export function createLogger(level: string, pretty: boolean): Logger {
    return pino({
        level,
        base: { service: 'carbonroute-proxy' },
        redact: ['req.headers.authorization', 'req.headers.cookie', '*.apiKey', '*.api_key'],
        ...(pretty
            ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' } } }
            : {}),
    });
}
