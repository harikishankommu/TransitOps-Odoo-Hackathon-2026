# Security Notes

Implemented final hardening:

- JWT validation with issuer, audience, algorithm, expiry, and active-user checks
- bcrypt password hashing
- Backend role authorization
- Security response headers
- Production Content Security Policy
- Same-origin checks and configurable CORS allowlist
- Authentication and API rate limiting
- Request body size limits
- Safe malformed-JSON handling
- Request IDs for server-error tracing
- Generic server error responses
- Graceful shutdown

Production recommendations:

- Move JWTs from local storage to secure HTTP-only cookies
- Use Redis for distributed rate limiting
- Use PostgreSQL
- Add dependency scanning and automated security tests
- Terminate TLS through a trusted reverse proxy
- Store secrets only in the deployment platform's secret manager
