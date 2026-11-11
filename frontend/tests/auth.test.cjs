const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { NextRequest, NextResponse } = require("next/server");

function load(file, dependencies = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module, exports: module.exports, URL, URLSearchParams, Headers, FormData, process,
    require(name) {
      if (name === "server-only") return {};
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return module.exports;
}
const paths = load("lib/auth/paths.ts");
class Redirect extends Error { constructor(destination) { super("redirect"); this.destination = destination; } }
const redirect = destination => { throw new Redirect(destination); };
const verified = { id: "user-a", email: "a@example.test", email_confirmed_at: "2026-11-04" };
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
async function redirected(run, expected) {
  await assert.rejects(run, error => error instanceof Redirect && (typeof expected === "function" ? expected(error.destination) : error.destination === expected));
}
function actions(client, authorize = async () => verified) {
  return load("app/auth/actions.ts", {
    "next/navigation": { redirect },
    "../../lib/auth/server": { createAuthClient: async () => client },
    "../../lib/auth/config": { siteOrigin: () => "https://learn.example.test" },
    "../../lib/auth/paths": paths,
    "../../lib/auth/authorization": { requireVerifiedUser: authorize },
  });
}

test("return destinations preserve scope and reject open redirects", () => {
  for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/%5cevil.test", "/%2f%2fevil.test", "/..//evil.test", "/a/..//evil.test", "/%2e%2e//evil.test", "/login", "/auth/callback", "/\n/evil.test", "%", "/bad%", "/" + "a".repeat(2050)]) {
    assert.equal(paths.safeNext(value), "/exam-prep", String(value));
  }
  const destination = "/exam-prep/attempts/123?class=XII&subject=statistics";
  assert.equal(paths.safeNext(destination), destination);
  assert.equal(new URL("https://learn.test" + paths.loginPath(destination)).searchParams.get("next"), destination);
  assert.equal(paths.isExamPath("/exam-prep"), true);
  assert.equal(paths.isExamPath("/exam-prep/nested"), true);
  assert.equal(paths.isExamPath("/exam-preparation"), false);
});

test("password login validates credentials server-side and preserves intended page", async () => {
  const next = "/exam-prep?subject=statistics";
  const api = actions({ auth: { signInWithPassword: async ({ email }) => {
    assert.equal(email, "a@example.test"); return { data: { user: verified }, error: null };
  } } });
  await redirected(() => api.login(form({ email: "a@example.test", password: "password123", next })), next);
  await redirected(() => api.login(form({ email: "bad", password: "pw", next })), target => target.includes("status=invalid"));
  let signedOut = false;
  const unconfirmed = actions({ auth: {
    signInWithPassword: async () => ({ data: { user: { id: "a" } }, error: null }),
    signOut: async () => { signedOut = true; return { error: null }; },
  } });
  await redirected(() => unconfirmed.login(form({ email: "a@example.test", password: "password123" })), target => target.includes("status=verify-email"));
  assert.equal(signedOut, true);
});

test("signup sends verification and cannot forward client role metadata", async () => {
  let payload;
  const api = actions({ auth: {
    signUp: async value => { payload = value; return { error: null }; },
    signOut: async () => ({ error: null }),
  } });
  await redirected(() => api.signup(form({ email: "a@example.test", password: "password123", display_name: "Student", role: "admin", next: "/exam-prep/chapter-9" })), target => target.includes("status=check-email"));
  assert.equal(payload.options.data.display_name, "Student");
  assert.equal(payload.options.data.role, undefined);
  const confirm = new URL(payload.options.emailRedirectTo);
  assert.equal(confirm.pathname, "/auth/confirm");
  assert.equal(confirm.searchParams.get("next"), "/exam-prep/chapter-9");
});

test("Google uses PKCE callback with a safe local destination", async () => {
  const api = actions({ auth: { signInWithOAuth: async payload => {
    assert.equal(payload.provider, "google");
    const callback = new URL(payload.options.redirectTo);
    assert.equal(callback.origin, "https://learn.example.test");
    assert.equal(callback.searchParams.get("next"), "/exam-prep");
    return { data: { url: "https://supabase.example.test/auth/v1/authorize" }, error: null };
  } } });
  await redirected(() => api.googleLogin(form({ next: "//evil.test" })), "https://supabase.example.test/auth/v1/authorize");
});

test("forgot password has the same safe response for known and unknown accounts", async () => {
  const destinations = [];
  for (const error of [null, { message: "unknown account" }]) {
    const api = actions({ auth: { resetPasswordForEmail: async (_email, options) => {
      const recovery = new URL(new URL(options.redirectTo).searchParams.get("next"), "https://learn.test");
      assert.equal(recovery.pathname, "/reset-password");
      assert.equal(recovery.searchParams.get("next"), "/exam-prep");
      return { error };
    } } });
    try { await api.forgotPassword(form({ email: "a@example.test" })); } catch (result) {
      assert.ok(result instanceof Redirect); destinations.push(result.destination);
    }
  }
  assert.equal(destinations[0], destinations[1]);
  assert.ok(destinations[0].includes("reset-sent"));
});

test("profile updates use the verified user ID, never a form-supplied ID", async () => {
  let owner;
  const api = actions({ from: table => { assert.equal(table, "profiles"); return {
    update: data => { assert.equal(data.display_name, "New name"); return { eq: async (column, id) => { assert.equal(column, "id"); owner = id; return { error: null }; } }; },
  }; } });
  await redirected(() => api.updateProfile(form({ id: "user-b", role: "admin", display_name: "New name" })), "/account?status=profile-saved");
  assert.equal(owner, "user-a");
});

test("reset requires verified auth, matching passwords, then logs out", async () => {
  let updated = false, signedOut = false;
  const api = actions({ auth: {
    updateUser: async value => { assert.equal(value.password, "new-password123"); updated = true; return { error: null }; },
    signOut: async value => { assert.equal(value.scope, "global"); signedOut = true; return { error: null }; },
  } });
  await redirected(() => api.resetPassword(form({ password: "new-password123", confirm_password: "mismatch" })), target => target.includes("status=invalid"));
  assert.equal(updated, false);
  await redirected(() => api.resetPassword(form({ password: "new-password123", confirm_password: "new-password123" })), target => target.includes("status=password-updated"));
  assert.equal(signedOut, true);
  const blocked = actions({}, async () => redirect("/login"));
  await redirected(() => blocked.resetPassword(form({ password: "new-password123" })), "/login");
});

test("logout is a server mutation and reports failure without claiming success", async () => {
  const api = actions({ auth: { signOut: async () => ({ error: null }) } });
  await redirected(() => api.logout(), "/login?status=logged-out");
  const failed = actions({ auth: { signOut: async () => ({ error: { message: "failure" } }) } });
  await redirected(() => failed.logout(), "/account?status=logout-failed");
});

function authorization(user, role, authError = null) {
  return load("lib/auth/authorization.ts", {
    react: { cache: fn => fn }, "next/navigation": { redirect }, "./paths": paths,
    "./server": { createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: authError }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role }, error: null }) }) }) }),
    }) },
  });
}
test("server guard rejects absent/unverified sessions and trusts database roles only", async () => {
  await redirected(() => authorization(null, "admin").requireVerifiedUser("/exam-prep/nested"), target => new URL(target, "https://local.test").searchParams.get("next") === "/exam-prep/nested");
  await redirected(() => authorization({ id: "a" }, "admin").requireVerifiedUser(), target => target.startsWith("/login"));
  await assert.rejects(() => authorization({ ...verified, user_metadata: { role: "admin" } }, "student").requireAdmin(), /Administrator access required/);
  assert.equal((await authorization(verified, "admin").requireAdmin()).id, "user-a");
});

for (const route of ["callback", "confirm"]) test(`${route} rejects failed/expired exchanges and preserves safe destinations`, async () => {
  for (const accepted of [false, true]) {
    const auth = {
      exchangeCodeForSession: async () => ({ error: accepted ? null : { message: "expired" } }),
      verifyOtp: async () => ({ error: accepted ? null : { message: "expired" } }),
      getUser: async () => ({ data: { user: verified } }), signOut: async () => ({ error: null }),
    };
    const handler = load(`app/auth/${route}/route.ts`, {
      "next/server": { NextResponse },
      "../../../lib/auth/server": { createAuthClient: async () => ({ auth }) },
      "../../../lib/auth/paths": paths,
    });
    const query = route === "callback" ? "code=test-code" : "token_hash=test-token&type=email";
    const response = await handler.GET(new NextRequest(`https://learn.test/auth/${route}?${query}&next=%2Fexam-prep%3Fsubject%3Dstatistics`));
    const location = new URL(response.headers.get("location"));
    assert.equal(location.origin, "https://learn.test");
    assert.equal(location.pathname, accepted ? "/exam-prep" : "/login");
    assert.equal(location.searchParams.has("token_hash"), false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("recovery token routes to password reset regardless of untrusted next", async () => {
  let type;
  const handler = load("app/auth/confirm/route.ts", {
    "next/server": { NextResponse }, "../../../lib/auth/paths": paths,
    "../../../lib/auth/server": { createAuthClient: async () => ({ auth: {
      verifyOtp: async input => { type = input.type; return { error: null }; },
      getUser: async () => ({ data: { user: verified } }),
    } }) },
  });
  const result = await handler.GET(new NextRequest("https://learn.test/auth/confirm?token_hash=test&type=recovery&next=//evil.test"));
  assert.equal(type, "recovery");
  assert.equal(result.headers.get("location"), "https://learn.test/reset-password");
});

test("Proxy fails closed, preserves cookies and protects nested destinations", async () => {
  for (const user of [null, verified]) {
    const handler = load("proxy.ts", {
      "next/server": { NextResponse }, "./lib/auth/paths": paths,
      "./lib/auth/config": { authConfig: () => ({ url: "https://supabase.test", key: "test-public-key" }), authCookieOptions: {} },
      "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => {
        options.cookies.setAll([{ name: "test-session", value: "rotated", options: { httpOnly: true, path: "/" } }]);
        return { data: { user }, error: null };
      } } }) },
    });
    const response = await handler.proxy(new NextRequest("https://learn.test/exam-prep/attempts/one?subject=statistics", { headers: { "x-babul-auth-path": "//evil.test" } }));
    assert.ok(response.headers.get("set-cookie").includes("test-session=rotated"));
    if (!user) {
      assert.equal(response.status, 303);
      const location = new URL(response.headers.get("location"));
      assert.equal(location.pathname, "/login");
      assert.equal(location.searchParams.get("next"), "/exam-prep/attempts/one?subject=statistics");
    } else {
      assert.equal(response.headers.get("x-middleware-request-x-babul-auth-path"), "/exam-prep/attempts/one?subject=statistics");
      assert.ok(response.headers.get("x-middleware-request-cookie").includes("test-session=rotated"));
    }
  }
});


test("Proxy denies access when config or Auth is unavailable", async () => {
  for (const configFails of [true, false]) {
    const handler = load("proxy.ts", {
      "next/server": { NextResponse }, "./lib/auth/paths": paths,
      "./lib/auth/config": { authConfig: () => { if (configFails) throw new Error("missing config"); return { url: "https://supabase.test", key: "test" }; }, authCookieOptions: {} },
      "@supabase/ssr": { createServerClient: () => ({ auth: { getUser: async () => { throw new Error("network failure"); } } }) },
    });
    const response = await handler.proxy(new NextRequest("https://learn.test/exam-prep"));
    assert.equal(response.status, 503);
    assert.equal(await response.text(), "Authentication is temporarily unavailable.");
  }
});

test("confirmation never accepts arbitrary OTP types", async () => {
  const handler = load("app/auth/confirm/route.ts", {
    "next/server": { NextResponse }, "../../../lib/auth/paths": paths,
    "../../../lib/auth/server": { createAuthClient: async () => ({ auth: {
      verifyOtp: async () => { throw new Error("Must not accept unsupported type"); },
    } }) },
  });
  const response = await handler.GET(new NextRequest("https://learn.test/auth/confirm?token_hash=test&type=invite"));
  assert.equal(new URL(response.headers.get("location")).pathname, "/login");
});

test("auth client waits for request time before reading cookies or constructing Supabase", async () => {
  const calls = [];
  let release;
  const request = new Promise(resolve => { release = resolve; });
  const store = { getAll: () => [], set: () => {} };
  const client = { auth: {} };
  const server = load("lib/auth/server.ts", {
    "next/server": { connection: async () => { calls.push("connection"); await request; } },
    "next/headers": { cookies: async () => { calls.push("cookies"); return store; } },
    "./config": { authConfig: () => ({ url: "https://example.supabase.co", key: "offline-test" }), authCookieOptions: {} },
    "@supabase/ssr": { createServerClient: () => { calls.push("supabase"); return client; } },
  });
  const pending = server.createAuthClient();
  await Promise.resolve();
  assert.deepEqual(calls, ["connection"]);
  release();
  assert.equal(await pending, client);
  assert.deepEqual(calls, ["connection", "cookies", "supabase"]);
});

test("auth client does not initialize a session if the request boundary fails", async () => {
  const stopped = new Error("request unavailable");
  const server = load("lib/auth/server.ts", {
    "next/server": { connection: async () => { throw stopped; } },
    "next/headers": { cookies: async () => { throw new Error("cookies must not be read"); } },
    "./config": { authConfig: () => { throw new Error("config must not be read"); }, authCookieOptions: {} },
    "@supabase/ssr": { createServerClient: () => { throw new Error("session must not initialize"); } },
  });
  await assert.rejects(server.createAuthClient(), error => error === stopped);
});
test("exam page navigation exposes a Suspense fallback before session validation", async () => {
  const Suspense = Symbol("Suspense");
  const element = (type, props) => ({ type, props });
  let checks = 0;
  let release;
  const request = new Promise(resolve => { release = resolve; });
  const dependencies = {
    "react": { Suspense },
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "next/link": { default: "Link" },
    "../../components/site-navbar": { default: "Navbar" },
    "../../lib/auth/authorization": { requireVerifiedUser: async next => {
      assert.equal(next, "/exam-prep");
      checks++;
      await request;
    } },
    "../auth/actions": { logout: () => {} },
  };
  const page = load("app/exam-prep/page.tsx", dependencies);
  const shell = page.default();
  assert.equal(shell.type, Suspense);
  assert.equal(shell.props.fallback.props.children, "Loading your account...");
  assert.equal(checks, 0);
  let resolved = false;
  const content = shell.props.children.type().then(value => { resolved = true; return value; });
  await Promise.resolve();
  assert.equal(checks, 1);
  assert.equal(resolved, false);
  release();
  assert.equal((await content).type, "div");

  const denied = load("app/exam-prep/page.tsx", {
    ...dependencies,
    "../../lib/auth/authorization": { requireVerifiedUser: async () => { throw new Redirect("/login"); } },
  });
  await assert.rejects(denied.default().props.children.type(), error => error instanceof Redirect);
});