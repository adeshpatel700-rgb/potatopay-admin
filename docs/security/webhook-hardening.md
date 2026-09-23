# Webhook Security Hardening

- Use constant-time string comparison (`crypto.timingSafeEqual`) to prevent timing attacks
- Enforce maximum clock skew of 300 seconds
