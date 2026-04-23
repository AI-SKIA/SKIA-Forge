# Developer Guide: Cookies and Sessions

## Runtime behavior
- SKIA uses session-based authentication for protected routes in the primary backend runtime.
- Web clients communicate through direct backend calls or Next proxy routes that preserve credentials.
- Mobile stores auth/session material through mobile-safe storage and sends credentials to backend APIs.

## Required practices
- Enable credentialed requests for protected endpoints.
- Keep cookie/session options consistent across local and production domains.
- Validate auth state before invoking protected multipart, billing, and orchestration APIs.

## Troubleshooting
- If auth appears to fail through frontend proxies, verify `credentials` forwarding.
- If mobile auth drifts, confirm base URL and session persistence configuration.
