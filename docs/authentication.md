# Phase 1 authentication

Implemented locally: email/password signup/login, Google OAuth (PKCE), verification/resend, password recovery, logout, owner-only profiles and database-managed roles. Existing study/chat/public routes remain public. No existing browser chat history is migrated into accounts or erased on logout. Do not use that localStorage history as private account data.

## Environment

Set these in `frontend/.env.local` (do not commit real credentials):

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project-publishable-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted if no publishable key is set. Use the URL/key for the same project. Never put a service-role key, secret key or Google client secret in a `NEXT_PUBLIC_*` variable. Production SITE_URL must be your exact HTTPS application origin. Use one origin consistently during local sign-in; do not alternate localhost and 127.0.0.1 mid-flow. Authentication is server-only: cookies are HttpOnly, SameSite=Lax and Secure in production. No browser Supabase client or global auth provider is necessary for this phase.

## Database migration (not applied by implementation)

1. Inspect the target for existing `public.profiles`, `public.user_roles` or overlapping signup triggers. The new migration deliberately fails on a conflicting schema rather than overwriting it.
2. Apply `supabase/migrations/20261104000100_auth_profiles.sql` to an approved local/staging project using the SQL Editor or `supabase migration up --local`. Do not use `db reset` on an existing database to install this change.
3. Run `supabase/tests/auth_rls.sql` on that local/staging database. It uses rollback-only fixtures and tests owner isolation, identity-column protection, anonymous denial and metadata/role escalation attempts.
4. Confirm actual signup creates a profile and a student role. The trigger/backfill never promotes a user based on `raw_user_meta_data`.

The migration enables RLS, grants authenticated users SELECT on their own profiles/role and UPDATE only on the profile `display_name` column. Clients cannot insert/delete profiles or write roles. Profiles are linked to `auth.users` with cascade deletion. Passwords and email identities stay in Supabase Auth, not profile rows.

Only a trusted project operator may promote an existing user, using their verified Auth user UUID in the SQL Editor:

```sql
update public.user_roles set role = 'admin' where user_id = '<existing-auth-user-uuid>';
```

There is no public admin-promotion endpoint. Future admin routes/actions must call `requireAdmin()`; future private data handlers must call `requireVerifiedUser()` and use ownership-aware RLS. Route layouts alone are not authorization for an API or Server Action.

## Supabase Auth dashboard

1. In Authentication ? Sign In / Providers (Email provider), enable Email signup and **Confirm email**. This is required. With confirmation disabled, Supabase treats new email accounts as already confirmed. The code cannot distinguish that from a real verification. Local `supabase/config.toml` now enables email confirmation.
2. In Authentication ? URL Configuration, set Site URL to the exact application origin matching NEXT_PUBLIC_SITE_URL.
3. Add redirect allow-list entries for the application `/auth/callback` and `/auth/confirm` URLs including their query parameters. For development, `http://localhost:3000/**` and/or `http://127.0.0.1:3000/**` are convenient. For the production origin use the narrower `https://<app-domain>/auth/callback**` and `https://<app-domain>/auth/confirm**` entries; do not allow arbitrary production origins. These patterns permit the encoded `next` query. `/auth/callback` is for Google code exchange; `/auth/confirm` verifies email token hashes.
4. Configure a production SMTP sender in Auth email settings before testing delivery to real students. Supabase's default sender is limited; local Supabase captures messages in its local email testing service. The application deliberately gives a generic response for password-reset and resend requests and does not expose whether an address exists.
5. Local template files are included at `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`, with references in the local config. Hosted projects do not automatically receive local templates. Configure these hosted email-template link targets, preserving the placeholders exactly. Use them as the `href` of the email's confirmation/reset link:

Confirm signup:

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Verify your email</a>
```

Reset password:

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
```

The application always supplies RedirectTo as `/auth/confirm?next=...`, so appending `&token_hash=...` is intentional. Verification supports opening the email in a different browser; it does not depend on the browser that requested signup. Do not leave a template that sends token hashes to a different route. Recovery tokens always lead to `/reset-password`, while the original intended page is carried through the reset/login sequence. Links are single-use and expire according to the project's Auth settings. The UI supports requesting a new link.

## Google OAuth setup (credentials are owner-supplied)

1. Open Google Cloud Console / Google Auth Platform for an owner-controlled project. Configure Branding, Audience and consent-screen contact information. If the app is in Testing, add the Google accounts used for testing as test users.
2. Create an OAuth Client ID of type **Web application**. Use the application origin(s) for Authorized JavaScript origins if required by the console.
3. Under **Authorized redirect URIs**, copy the exact callback URL displayed in Supabase Authentication ? Providers ? Google. A hosted project normally uses `https://<project-ref>.supabase.co/auth/v1/callback`. This is Google's redirect to Supabase, NOT the application's `/auth/callback` URL. For a local Supabase Auth service it is `http://127.0.0.1:54321/auth/v1/callback`.
4. In Supabase Authentication ? Providers ? Google, enable Google and enter the actual Client ID and Client Secret from Google. Store the secret only in the provider settings (or server secrets for local Supabase). No credentials were created or invented in this implementation.
5. Keep the application callback allow-listed as described above. Test a full Google round trip and intended-page restoration before production use.
6. For local Supabase Google testing, add `[auth.external.google]` in the local config with `enabled = true`, the real client ID and `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"`. Put that secret in the CLI environment. This block is not enabled by this implementation because credentials are not available.

Reference: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
Reference: https://supabase.com/docs/guides/auth/server-side/creating-a-client

## Routes and server enforcement

- `/login`, `/signup`, `/forgot-password`: public forms, using Next.js Server Actions with built-in origin protection.
- `/auth/callback`: code exchange for Google OAuth.
- `/auth/confirm`: token-hash verification for signup/recovery.
- `/reset-password`, `/account`, `/exam-prep/**`: protected by a targeted Proxy and server-side `getUser()` validation. No client-only guard and no trust in `getSession()` or client-submitted user IDs.
- `/exam-prep`: authentication-only placeholder, no exam generator/evaluation implementation.

The proxy overwrites the internal intended-path header and forwards refreshed cookies into the server request and response. Auth responses are not publicly cacheable. Auth UI/session reads sit behind Suspense for the project's Cache Components configuration. Internal redirects reject external, protocol-relative, encoded and normalized open-redirect destinations. All new profile writes derive the user ID from a verified session.

## Checks and manual verification

From `frontend`:

```powershell
node --test tests/auth.test.cjs tests/study-workspace.test.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build
```

After applying the migration/configuration to local/staging:

1. Visit `/exam-prep?class=XII&subject=computer-science` signed out. Log in and confirm that full local destination is restored.
2. Sign up with email/password; access stays blocked until confirmation. Open the email in another browser and verify; request a new email after an expired link.
3. Exercise Google signup and returning-user login. Check there is one profile/student-role row per Auth user.
4. Request a password reset for both existing/nonexistent accounts; confirm generic UI, valid reset, mismatched-password rejection, and expired-token rejection. Log in with the new password.
5. Update a display name; verify email/UUID/role cannot be changed through crafted form data or the Data API. Run auth_rls.sql with two users.
6. Log out and revisit/refresh protected URLs; no protected content is returned. Other public routes and pre-existing chat localStorage remain unchanged.
7. Test session renewal after access-token expiry and direct navigation to protected pages. Verify no caching of user-specific content by a shared CDN.

Do not infer working Google/SMTP/live RLS from mocked Node tests or a TypeScript pass. They require the above integration checks on a configured Supabase project. No dashboard configuration, migration application, deployment, commit or push is performed automatically.


## Verification recorded during implementation

- 18 focused Node tests passed, including existing study/history regressions.
- TypeScript passed; new authentication files passed ESLint with no warnings.
- Webpack production build passed. The default Turbopack build was blocked by Google-font module resolution in the existing root font configuration and emitted existing chapters CSS warnings; those files were not changed.
- An isolated webpack build with explicit dummy public configuration passed, then real localhost HTTP requests verified all three public auth forms, four protected redirects (including nested/query destinations), and the existing public chat route. No real Auth accounts or provider calls were used for this smoke test. Next.js embeds public environment variables at build time: configure real values and rebuild before using real Auth.
- Database SQL tests were prepared but not executed: the Docker Desktop Linux engine was unavailable, and there is no local PostgreSQL/Supabase CLI executable. No remote database was modified.
- Google/SMTP/email verification/live session and database integration still require owner configuration and the manual checks above.
- Dependency installation reported 16 moderate advisories across the dependency tree. No unrelated dependency upgrades were applied.

## Exact changed-file inventory

- `docs/authentication.md`
- `frontend/app/account/page.tsx`
- `frontend/app/auth/actions.ts`
- `frontend/app/auth/callback/route.ts`
- `frontend/app/auth/confirm/route.ts`
- `frontend/app/exam-prep/layout.tsx`
- `frontend/app/exam-prep/page.tsx`
- `frontend/app/forgot-password/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/reset-password/page.tsx`
- `frontend/app/signup/page.tsx`
- `frontend/components/auth/auth-screen.tsx`
- `frontend/components/auth/submit-button.tsx`
- `frontend/lib/auth/authorization.ts`
- `frontend/lib/auth/config.ts`
- `frontend/lib/auth/paths.ts`
- `frontend/lib/auth/server.ts`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/proxy.ts`
- `frontend/tests/auth.test.cjs`
- `supabase/config.toml`
- `supabase/functions/ai-chat/scope.ts`
- `supabase/migrations/20261104000100_auth_profiles.sql`
- `supabase/templates/confirmation.html`
- `supabase/templates/recovery.html`
- `supabase/tests/auth_rls.sql`
