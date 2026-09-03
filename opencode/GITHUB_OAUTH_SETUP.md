# GitHub OAuth Configuration

## Required Environment Variables

```bash
# GitHub OAuth Application ID
# Create at: https://github.com/settings/developers
GITHUB_OAUTH_CLIENT_ID=your_client_id_here

# GitHub OAuth Application Secret (NEVER commit this)
# Keep this secure - only store in environment variables
GITHUB_OAUTH_CLIENT_SECRET=your_client_secret_here

# GitHub OAuth Redirect URI
# Must match exactly with what's configured in your GitHub App
# Example: http://localhost:4096/api/github/callback
# Production: https://yourdomain.com/api/github/callback
GITHUB_OAUTH_REDIRECT_URI=http://localhost:4096/api/github/callback

# Enable GitHub OAuth feature
GITHUB_OAUTH_ENABLED=true
```

## Setup Instructions

### 1. Create GitHub OAuth Application

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in the form:
   - **Application name**: Sory Code
   - **Homepage URL**: http://localhost:4096 (or your domain)
   - **Application description**: Remote development environment
   - **Authorization callback URL**: http://localhost:4096/api/github/callback

4. Copy the Client ID and Client Secret

### 2. Configure Environment Variables

Set the following in your `.env` file or environment:
- `GITHUB_OAUTH_CLIENT_ID` - from GitHub App
- `GITHUB_OAUTH_CLIENT_SECRET` - from GitHub App (keep secure!)
- `GITHUB_OAUTH_REDIRECT_URI` - must match GitHub App callback URL
- `GITHUB_OAUTH_ENABLED=true`

### 3. Token Storage

GitHub OAuth tokens are stored securely using the existing auth system:
- Encrypted storage in `~/.opencode/auth.json`
- Never exposed in URLs, logs, or frontend
- Automatically refreshed when expired
- User logout removes token

## API Endpoints (ÉTAPE 1)

### Start OAuth Flow
```
POST /api/github/auth/start
Response: { state: string, url: string }
```

### OAuth Callback (Automatic)
```
GET /api/github/auth/callback?code=...&state=...
Returns: { access_token: string, state: string }
```

### Get Authenticated User
```
GET /api/github/user
Headers: Authorization: Bearer {token}
Response: { id, login, name, email, avatarUrl }
```

### List User Repositories
```
GET /api/github/repositories?page=1&per_page=30
Headers: Authorization: Bearer {token}
Response: [{ id, name, fullName, url, htmlUrl, isPrivate, owner }]
```

### List Repository Branches
```
GET /api/github/repositories/{owner}/{repo}/branches?page=1&per_page=30
Headers: Authorization: Bearer {token}
Response: [{ name, commit, isProtected }]
```

## Security Notes

⚠️ **CRITICAL**
- Never commit `.env` files with secrets
- Never log or display tokens
- Never pass tokens in URLs
- Always use HTTPS in production
- Rotate secrets if compromised

✅ **Best Practices**
- Store secrets in environment variables only
- Use different OAuth apps for dev/staging/production
- Monitor token usage and revoke unused apps
- Keep token expiry times short when possible
- Implement proper CORS policies

## Frontend Integration

The frontend will:
1. Show "Sign in with GitHub" button
2. Open OAuth flow in browser
3. GitHub redirects back to Sory Code
4. Token stored securely server-side
5. Frontend accesses via authenticated endpoints

No tokens are stored in localStorage or visible to user.

## Troubleshooting

### "GitHub OAuth not configured" error
- Check env vars are set and GITHUB_OAUTH_ENABLED=true
- Verify GITHUB_OAUTH_CLIENT_ID and CLIENT_SECRET exist

### "Invalid redirect URI" error
- Ensure GITHUB_OAUTH_REDIRECT_URI exactly matches GitHub App setting
- Check for trailing slashes or protocol mismatches

### "401 Unauthorized" on API calls
- Token may be expired - refresh needed
- Token may be invalid - user needs to login again
- Check Authorization header format: `Bearer {token}`

### "No repositories found"
- User may have no accessible repos
- Check GitHub account has permission to repos
- Verify token scope includes 'repo'
