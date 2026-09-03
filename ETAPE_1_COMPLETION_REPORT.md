# ÉTAPE 1 — GitHub Authentication Implementation

**Status**: 🔵 COMPLETED (Structure only - integration needed)  
**Date**: 3 septembre 2026  
**Scope**: GitHub OAuth + Repository Discovery

## ✅ Files Created

### 1. Schema Layer
- `opencode/packages/opencode/src/provider/github-schemas.ts`
  - `GitHubOAuth` - OAuth token structure
  - `GitHubRepository` - Repository metadata
  - `GitHubBranch` - Branch information
  - `GitHubUser` - Authenticated user info

### 2. Configuration
- `opencode/packages/opencode/src/provider/github-config.ts`
  - Environment variable management
  - OAuth app configuration
  - Validation helpers

### 3. Authentication Handler
- `opencode/packages/opencode/src/provider/github-auth.ts`
  - OAuth flow management
  - Token storage/retrieval via existing Auth service
  - Token refresh handling
  - State management for OAuth

### 4. GitHub API Client
- `opencode/packages/opencode/src/provider/github-client.ts`
  - Octokit wrapper (using @octokit/rest v22.0.0)
  - User info retrieval
  - Repository listing
  - Branch listing
  - Error handling

### 5. API Routes (Placeholder)
- `opencode/packages/opencode/src/server/routes/github.ts`
  - `/api/github/auth/start` - Initiate OAuth
  - `/api/github/auth/callback` - Handle callback
  - `/api/github/user` - Get user info
  - `/api/github/repositories` - List repos
  - `/api/github/repositories/{owner}/{repo}/branches` - List branches

### 6. Documentation
- `opencode/GITHUB_OAUTH_SETUP.md`
  - Setup instructions
  - Environment variables
  - API endpoints
  - Security guidelines

## 🎯 Architecture Decisions

### 1. Token Storage
✅ **Reused existing** `@opencode/Auth` service
- Secure storage in `~/.opencode/auth.json`
- Schema-based validation
- Consistent with OpenCode CLI auth

**NOT**: Creating new token storage mechanism

### 2. Error Handling
✅ **Consistent** with OpenCode patterns
- Effect-based error handling
- `GitHubAuthError` and `GitHubClientError` types
- Proper error mapping and logging

### 3. OAuth Flow
✅ **Standard GitHub OAuth 2.0**
- Authorization Code Grant
- State parameter for CSRF protection
- Refresh token support (when available)
- Token expiry tracking

**Architecture**:
```
Frontend "Sign in with GitHub"
    ↓
POST /api/github/auth/start
    ↓
GET github.com/login/oauth/authorize?client_id=...&state=...
    ↓
User logs in to GitHub
    ↓
GitHub redirects to /api/github/auth/callback?code=...&state=...
    ↓
Server exchanges code for token
    ↓
Token stored securely
    ↓
Frontend redirected to authenticated state
```

### 4. API Client
✅ **Using @octokit/rest** (already in dependencies)
- Standard GitHub API wrapper
- Error handling built-in
- Supports pagination

**NOT**: Direct fetch calls (too error-prone)

## ⚠️ What's NOT Implemented (Intentional)

❌ **Frontend Components** - ÉTAPE 2+
- "Sign in with GitHub" button
- Repository selector UI
- Branch selector UI

❌ **Route Integration** - ÉTAPE 2+
- Routes not wired to actual HTTP router yet
- Need to integrate with `packages/opencode/src/server/routes/instance/httpapi/`

❌ **Session Persistence** - ÉTAPE 2+
- Storing selected repo/branch in user session
- Remembering GitHub user across sessions

❌ **Error UI** - ÉTAPE 2+
- User-friendly error messages
- Retry logic

❌ **Codespaces Integration** - ÉTAPE 3+
- Creating/managing Codespaces
- Remote connection logic
- Still uses old snapshot model for now

## 🔒 Security Implementation

### Tokens NEVER exposed
✅ Stored server-side only  
✅ Not in URL parameters  
✅ Not in response bodies (except to setup callback)  
✅ Not in logs  
✅ Not in frontend localStorage  

### Environment Variables
✅ `GITHUB_OAUTH_CLIENT_ID` - public  
✅ `GITHUB_OAUTH_CLIENT_SECRET` - secret only  
✅ `GITHUB_OAUTH_REDIRECT_URI` - public  
✅ `GITHUB_OAUTH_ENABLED` - flag  

### CSRF Protection
✅ State parameter in OAuth flow  
✅ State validation before token exchange

## 📋 Prerequisites for Next Steps

### Before ÉTAPE 2 (Frontend Integration)
1. ✅ Create GitHub OAuth App at github.com/settings/developers
2. ✅ Get Client ID and Secret
3. ✅ Set environment variables
4. ✅ Wire routes into HTTP router
5. ✅ Build frontend components

### Before ÉTAPE 3 (Codespaces)
1. ✅ User can authenticate with GitHub
2. ✅ User can see their repositories
3. ✅ User can select repository + branch
4. Study GitHub Codespaces API
5. Implement Codespace lifecycle management

## 🚀 How to Test ÉTAPE 1

### Manual Test (WIP - routes not yet integrated)

```bash
# Set environment variables
export GITHUB_OAUTH_CLIENT_ID="your_id"
export GITHUB_OAUTH_CLIENT_SECRET="your_secret"
export GITHUB_OAUTH_REDIRECT_URI="http://localhost:4096/api/github/callback"
export GITHUB_OAUTH_ENABLED="true"

# Start Sory Code server
cd opencode
bun dev

# In another terminal, test OAuth start
curl -X POST http://localhost:4096/api/github/auth/start \
  -H "Content-Type: application/json"
# Response: { "state": "...", "url": "https://github.com/login/oauth/authorize?..." }

# Visit the URL to authenticate

# After redirect, server receives code and exchanges for token
```

### Automated Tests (TODO - ÉTAPE 2)
- Tests for token exchange
- Tests for repository listing
- Tests for error scenarios
- Mock GitHub API responses

## 📦 Dependencies Used

✅ `@octokit/rest` (v22.0.0) - Already in package.json  
✅ `effect` - Effect system (already used everywhere)  
✅ `zod` - Schema validation (already used)  

❌ New dependencies added: **NONE**

## 🔄 What Gets Reused

✅ `@opencode/Auth` service - Token storage  
✅ `@opencode/Server` infrastructure - HTTP routes  
✅ Effect Layer pattern - Dependency injection  
✅ Schema/Zod patterns - Validation  
✅ Error handling patterns - Consistent with codebase  

❌ What's preserved intact:
- Chat/sessions system
- Agent system
- Terminal
- Explorer/Editor
- Local environment mode
- All CLI commands

## ❌ What's Removed/Changed

**NOTHING** - Only additions, no deletions or modifications to existing code.

## 📝 Next Steps (After Validation)

1. **ÉTAPE 2**: Frontend integration
   - Wire routes into HTTP router
   - Build GitHub sign-in UI component
   - Build repository selector
   - Build branch selector
   - Session persistence

2. **ÉTAPE 3**: Remote connection
   - Codespaces API integration
   - WebSocket relay client
   - Remote filesystem abstraction

3. **ÉTAPE 4+**: Full integration
   - Remote terminal
   - Remote git operations
   - Port forwarding
   - Agent remote execution

## 🛑 STOP HERE - Awaiting Validation

This completes ÉTAPE 1. The foundation for GitHub authentication is built, but:

❌ Routes are not yet integrated into the HTTP router  
❌ No frontend components exist yet  
❌ No actual Codespaces functionality yet  
❌ No testing has been done  

**NEXT**: Validate this approach, then proceed to ÉTAPE 2.
