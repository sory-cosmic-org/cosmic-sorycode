---
name: Client generation boundary
description: Which generated client to use for new instance-level endpoints in the session UI.
---

For new instance-level endpoints used by the session UI, use the generated V2
client exposed through the server SDK context; the generic client and legacy
compatibility API do not necessarily expose the same instance routes.

**Why:** The application keeps a compatibility layer for legacy servers while
the V2 SDK is generated directly from the OpenCode server OpenAPI document.

**How to apply:** Regenerate `packages/sdk/js` after changing public instance
routes, then call the V2 client through the existing server SDK context so its
workspace routing and authentication remain centralized.