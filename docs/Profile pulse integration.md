# profile-pulse: local integration guide

This guide takes you from an empty folder to a deployed Cloudflare Worker that refreshes the stats strip on the `shreesharma07` profile, with the Worker living in its own repo (`shreesharma07/profile-pulse`) and mounted as a git submodule inside the profile repo (`shreesharma07/shreesharma07`) at `workers/profile-pulse`. Every file is included in full, written as a copy and paste command, so this document is enough on its own.

## Contents

1. Final layout
2. Prerequisites
3. Create the profile-pulse repo
4. Add the project files
5. Install and log in
6. Create the secrets
7. Test locally
8. Deploy to Cloudflare
9. First real run
10. Push profile-pulse
11. Add it as a submodule of the profile repo
12. Retire the old stats workflow
13. Verify everything
14. Day to day workflow
15. Optional: auto deploy on push
16. Command reference
17. Troubleshooting

## 1. Final layout

```text
~/code/
├── profile-pulse/                     standalone repo: shreesharma07/profile-pulse
│   ├── .dev.vars                      local secrets (git-ignored)
│   ├── .dev.vars.example
│   ├── .gitignore
│   ├── README.md
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── wrangler.toml
│   └── src/
│       ├── index.js
│       ├── metrics.js
│       ├── render.js
│       └── github.js
│
└── shreesharma07/                     profile repo: shreesharma07/shreesharma07
    ├── .gitmodules                    created by git submodule add
    ├── README.md
    ├── assets/
    │   ├── stats.json                 written by the Worker
    │   └── stats.svg                  written by the Worker
    ├── .github/workflows/
    │   ├── snake.yml                  stays on Actions
    │   └── profile-3d.yml             stays on Actions
    └── workers/
        └── profile-pulse/             submodule pinned to a profile-pulse commit
```

`~/code` is only an example parent folder; use wherever you keep repos. The two repos are cloned side by side for development, and the profile repo additionally carries profile-pulse as a submodule so the whole portfolio is reachable from one place.

## 2. Prerequisites

Check each tool:

```bash
node --version      # v20 or newer
pnpm --version      # 9 or newer
git --version       # 2.30 or newer
gh --version        # optional, GitHub CLI
openssl version     # for generating RUN_KEY
```

If pnpm is missing:

```bash
corepack enable pnpm
# or
npm install -g pnpm
```

If you want the GitHub CLI, install it from <https://cli.github.com> and run `gh auth login` once. You also need a free Cloudflare account (<https://dash.cloudflare.com/sign-up>).

On Windows, run everything in Git Bash or WSL so the `cat <<'EOF'` commands below work unchanged.

## 3. Create the profile-pulse repo

With the GitHub CLI:

```bash
mkdir -p ~/code && cd ~/code
gh repo create shreesharma07/profile-pulse --public \
  --description "Cloudflare Worker that refreshes my GitHub profile stats" \
  --clone
cd profile-pulse
```

Without the CLI, create an empty public repo named `profile-pulse` on github.com (no README, no .gitignore, no license), then:

```bash
mkdir -p ~/code && cd ~/code
git clone https://github.com/shreesharma07/profile-pulse.git
cd profile-pulse
```

Make sure the default branch is `main`:

```bash
git branch -M main
```

## 4. Add the project files

Run each block from inside `~/code/profile-pulse`. Each one creates the file with its full contents. If you downloaded `profile-pulse.zip`, you can instead unzip it and copy its contents here, then skip to step 5.

### 4.1 `package.json`

Project manifest, pnpm scripts and the Wrangler dev dependency.

```bash
mkdir -p . 2>/dev/null
cat > package.json <<'PULSE_EOF'
{
  "name": "profile-pulse",
  "version": "1.0.0",
  "private": true,
  "description": "Cloudflare Worker that refreshes the GitHub profile stats strip for shreesharma07 and commits it through the GitHub API",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --test-scheduled",
    "deploy": "wrangler deploy",
    "deploy:dry": "wrangler deploy --dry-run --outdir dist",
    "tail": "wrangler tail --format pretty",
    "secrets": "wrangler secret list",
    "whoami": "wrangler whoami"
  },
  "devDependencies": {
    "wrangler": "^4"
  },
  "engines": {
    "node": ">=20"
  }
}
PULSE_EOF
```

### 4.2 `wrangler.toml`

Worker name, cron schedule and non-secret configuration.

```bash
mkdir -p . 2>/dev/null
cat > wrangler.toml <<'PULSE_EOF'
name = "profile-pulse"
main = "src/index.js"
compatibility_date = "2026-10-01"
workers_dev = true

# Same schedule the old profile-stats.yml used (cron is always UTC).
# 06:30 UTC = 12:00 IST. Free plan allows 5 cron triggers per account.
[triggers]
crons = ["30 6 * * *"]

[observability]
enabled = true

[vars]
GH_OWNER = "shreesharma07"
GH_REPO = "shreesharma07"          # profile README repo the Worker commits into
GH_BRANCH = "main"
STATS_JSON_PATH = "assets/stats.json"
STATS_SVG_PATH = "assets/stats.svg"
# Public WakaTime share URL (wakatime.com > Settings > Embeddables > JSON). Empty skips it.
WAKATIME_JSON_URL = ""
DRY_RUN = "false"

# Secrets (never put them here):
#   pnpm wrangler secret put GH_TOKEN   fine-grained PAT, only the profile repo, Contents: read and write
#   pnpm wrangler secret put RUN_KEY    random string guarding /run and /preview
PULSE_EOF
```

### 4.3 `.gitignore`

Keeps dependencies, build output and local secrets out of git.

```bash
mkdir -p . 2>/dev/null
cat > .gitignore <<'PULSE_EOF'
node_modules/
dist/
.wrangler/
.dev.vars
.env
*.log
.DS_Store
PULSE_EOF
```

### 4.4 `.dev.vars.example`

Template for local secrets used by `pnpm dev`.

```bash
mkdir -p . 2>/dev/null
cat > .dev.vars.example <<'PULSE_EOF'
# Copy to .dev.vars for `pnpm dev`. .dev.vars is git-ignored.
GH_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxx
RUN_KEY=replace-with-output-of-openssl-rand-hex-24
# Keep local runs from committing to the real repo
DRY_RUN=true
PULSE_EOF
```

### 4.5 `src/index.js`

Entry point: cron handler and the `/run`, `/preview`, `/health` routes.

```bash
mkdir -p src 2>/dev/null
cat > src/index.js <<'PULSE_EOF'
// profile-pulse: replaces .github/workflows/profile-stats.yml
// Cron (or /run) -> fetch public metrics -> render SVG -> one atomic commit via GitHub API.

import { collectMetrics } from "./metrics.js";
import { renderStatsSvg } from "./render.js";
import { createGitHubClient } from "./github.js";

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      refresh(env)
        .then((r) => console.log("profile-pulse", controller.cron, JSON.stringify(r)))
        .catch((e) => {
          console.error("profile-pulse failed", e?.stack ?? e);
          throw e;
        })
    );
  },

  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/health") return Response.json({ ok: true });

    const authorized = Boolean(env.RUN_KEY) && url.searchParams.get("key") === env.RUN_KEY;
    if (!authorized) return new Response("Not found", { status: 404 });

    // Manual run, the equivalent of workflow_dispatch. Add &dry=1 to skip the commit.
    if (url.pathname === "/run") {
      const dry = url.searchParams.get("dry") === "1";
      return Response.json(await refresh(env, { dryRun: dry }));
    }

    // Render with live data and return the SVG without committing.
    if (url.pathname === "/preview") {
      const r = await refresh(env, { dryRun: true });
      return new Response(r.svg, {
        headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function refresh(env, { dryRun = false } = {}) {
  const dry = dryRun || env.DRY_RUN === "true";
  const jsonPath = env.STATS_JSON_PATH || "assets/stats.json";
  const svgPath = env.STATS_SVG_PATH || "assets/stats.svg";
  const gh = createGitHubClient(env);

  // Last good values, so a failed source keeps its previous number.
  const prev = (await gh.readJson(jsonPath)) ?? {};
  const { metrics, failures } = await collectMetrics(env, prev);
  const svg = renderStatsSvg(metrics);

  const { updatedAt, ...prevMetrics } = prev;
  const changed = JSON.stringify(metrics) !== JSON.stringify(prevMetrics);

  if (dry) return { committed: false, reason: "dry run", changed, metrics, failures, svg };
  if (!changed) return { committed: false, reason: "no change", metrics, failures };

  const payload = { ...metrics, updatedAt: new Date().toISOString() };
  const sha = await gh.commitFiles(
    {
      [jsonPath]: JSON.stringify(payload, null, 2) + "\n",
      [svgPath]: svg,
    },
    "chore: refresh profile stats"
  );
  return { committed: true, sha, metrics, failures };
}
PULSE_EOF
```

### 4.6 `src/metrics.js`

Public metric fetchers with last-good-value fallback. Never sees the token.

```bash
mkdir -p src 2>/dev/null
cat > src/metrics.js <<'PULSE_EOF'
// Public, unauthenticated sources only. GH_TOKEN never reaches this module.

const API = "https://api.github.com";
const UA = "profile-pulse-worker";

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function followers(user) {
  const u = await getJson(`${API}/users/${user}`);
  return u.followers;
}

async function stars(user) {
  // At most 3 pages (300 repos): stays far below the free plan's 50 subrequests.
  let total = 0;
  for (let page = 1; page <= 3; page++) {
    const repos = await getJson(`${API}/users/${user}/repos?per_page=100&page=${page}&type=owner`);
    for (const r of repos) if (!r.fork) total += r.stargazers_count;
    if (repos.length < 100) break;
  }
  return total;
}

async function wakatime(shareUrl) {
  if (!shareUrl) return null;
  const j = await getJson(shareUrl);
  // Covers the "all time" and "coding activity" embeddable shapes.
  return (
    j?.data?.grand_total?.human_readable_total_including_other_language ??
    j?.data?.text ??
    null
  );
}

async function profileViews(user) {
  // Replace with the source build-profile.mjs used, if different.
  const res = await fetch(`https://komarev.com/ghpvc/?username=${user}&style=flat`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`views -> HTTP ${res.status}`);
  const text = await res.text();
  const nums = [...text.matchAll(/>([\d,]+)</g)].map((m) => m[1]);
  return nums.length ? Number(nums.at(-1).replace(/,/g, "")) : null;
}

export async function collectMetrics(env, prev) {
  const user = env.GH_OWNER;
  const sources = {
    followers: () => followers(user),
    stars: () => stars(user),
    wakatime: () => wakatime(env.WAKATIME_JSON_URL),
    views: () => profileViews(user),
  };

  const keys = Object.keys(sources);
  const results = await Promise.allSettled(keys.map((k) => sources[k]()));

  const metrics = {};
  const failures = {};
  results.forEach((r, i) => {
    const key = keys[i];
    if (r.status === "fulfilled" && r.value != null) {
      metrics[key] = r.value;
    } else {
      metrics[key] = prev[key] ?? null;
      if (r.status === "rejected") failures[key] = String(r.reason?.message ?? r.reason);
    }
  });
  return { metrics, failures };
}
PULSE_EOF
```

### 4.7 `src/render.js`

SVG renderer. Replace the body with the design from `tools/build-profile.mjs`.

```bash
mkdir -p src 2>/dev/null
cat > src/render.js <<'PULSE_EOF'
// Replace the body with the renderer from tools/build-profile.mjs to keep your exact design.
// Keep it a pure string builder: the free plan allows 10 ms of CPU per run.

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmt = (v) => (v == null ? "n/a" : typeof v === "number" ? v.toLocaleString("en-US") : esc(v));

export function renderStatsSvg(m) {
  const cells = [
    ["Followers", fmt(m.followers)],
    ["Stars", fmt(m.stars)],
    ["Coding time", fmt(m.wakatime)],
    ["Profile views", fmt(m.views)],
  ];
  const cellW = 200;
  const width = cellW * cells.length;
  const body = cells
    .map(
      ([label, value], i) => `
  <g transform="translate(${i * cellW + 20},0)">
    <text y="34" class="v">${value}</text>
    <text y="56" class="l">${label}</text>
  </g>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="76" viewBox="0 0 ${width} 76" role="img" aria-label="Profile stats">
  <style>
    .v{font:600 22px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:#58a6ff}
    .l{font:400 13px -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:#8b949e}
  </style>${body}
</svg>
`;
}
PULSE_EOF
```

### 4.8 `src/github.js`

The only module holding `GH_TOKEN`; commits both files atomically.

```bash
mkdir -p src 2>/dev/null
cat > src/github.js <<'PULSE_EOF'
// The only module that holds GH_TOKEN. Commits several files atomically:
// blobs inline in a tree -> commit -> fast-forward the branch ref.

const API = "https://api.github.com";

export function createGitHubClient(env) {
  if (!env.GH_TOKEN) throw new Error("GH_TOKEN secret is not set");
  const base = `${API}/repos/${env.GH_OWNER}/${env.GH_REPO}`;
  const branch = env.GH_BRANCH || "main";
  const headers = {
    Authorization: `Bearer ${env.GH_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "profile-pulse-worker",
  };

  async function call(path, init = {}) {
    const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!res.ok) {
      const err = new Error(`GitHub ${init.method ?? "GET"} ${path} -> HTTP ${res.status}: ${await res.text()}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  return {
    async readJson(path) {
      try {
        const f = await call(`/contents/${path}?ref=${branch}`);
        const bytes = Uint8Array.from(atob(f.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch (e) {
        if (e.status === 404) return null; // first run
        throw e;
      }
    },

    async commitFiles(files, message, attempt = 0) {
      const ref = await call(`/git/ref/heads/${branch}`);
      const parentSha = ref.object.sha;
      const parent = await call(`/git/commits/${parentSha}`);

      const tree = await call(`/git/trees`, {
        method: "POST",
        body: JSON.stringify({
          base_tree: parent.tree.sha,
          tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
        }),
      });

      const commit = await call(`/git/commits`, {
        method: "POST",
        body: JSON.stringify({
          message,
          tree: tree.sha,
          parents: [parentSha],
          author: { name: "profile-pulse", email: "profile-pulse@users.noreply.github.com" },
        }),
      });

      try {
        await call(`/git/refs/heads/${branch}`, {
          method: "PATCH",
          body: JSON.stringify({ sha: commit.sha, force: false }),
        });
      } catch (e) {
        // 422: branch moved (snake or 3D Action pushed meanwhile). Rebuild on the new head.
        if (e.status === 422 && attempt < 2) return this.commitFiles(files, message, attempt + 1);
        throw e;
      }
      return commit.sha;
    },
  };
}
PULSE_EOF
```

### 4.9 `README.md`

Repository readme shown on GitHub.

````bash
mkdir -p . 2>/dev/null
cat > README.md <<'PULSE_EOF'
# profile-pulse

A Cloudflare Worker that keeps the stats strip on the [shreesharma07](https://github.com/shreesharma07/shreesharma07) GitHub profile fresh. Once a day it fetches followers, stars, WakaTime coding time and profile views, redraws `assets/stats.svg`, and commits it together with `assets/stats.json` straight into the profile repo through the GitHub API. It replaces the `profile-stats.yml` GitHub Action and runs entirely on the Cloudflare Workers free plan.

## How it works

```
Cron Trigger (06:30 UTC)  or  GET /run?key=...
        │
        ▼
read assets/stats.json from the profile repo (last good values)
        │
        ▼
fetch followers · stars · WakaTime · views in parallel (public endpoints, no token)
        │   a source that fails keeps its previous value
        ▼
render assets/stats.svg
        │   nothing changed → stop, no commit
        ▼
one atomic commit of both files via the Git Data API
(tree → commit → fast-forward main, retried if main moved)
```

The Worker never runs git or a shell. The token is only loaded by `src/github.js`; the metric fetchers never see it.

## Repository layout

| Path | Purpose |
| --- | --- |
| `src/index.js` | Entry point: cron handler, `/run`, `/preview`, `/health` routes |
| `src/metrics.js` | Public metric fetchers with last-good-value fallback |
| `src/render.js` | SVG renderer (swap in the design from `tools/build-profile.mjs`) |
| `src/github.js` | Atomic multi-file commit through the GitHub API |
| `wrangler.toml` | Worker name, cron schedule, non-secret configuration |
| `.dev.vars.example` | Template for local secrets |

## Prerequisites

Node.js 20 or newer, pnpm, git, a free Cloudflare account, and optionally the GitHub CLI (`gh`). Install pnpm with `corepack enable pnpm` or `npm i -g pnpm` if you don't have it.

## Step by step setup

### 1. Create the repository

With the GitHub CLI:

```bash
gh repo create shreesharma07/profile-pulse --public \
  --description "Cloudflare Worker that refreshes my GitHub profile stats" \
  --clone
cd profile-pulse
```

Or create an empty public repo named `profile-pulse` on github.com (no README, no .gitignore) and clone it.

### 2. Add the project files

Copy every file from this project into the clone, then install:

```bash
pnpm install
```

### 3. Log in to Cloudflare

```bash
pnpm wrangler login     # opens the browser, no API key needed
pnpm whoami             # confirms the account
```

### 4. Create the GitHub token (`GH_TOKEN`)

On GitHub go to Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Name it `profile-pulse`, set an expiry (a year, with a calendar reminder), choose **Only select repositories** → `shreesharma07/shreesharma07`, and under Repository permissions set **Contents: Read and write**. Leave everything else at No access. Copy the token.

### 5. Create the run key (`RUN_KEY`)

This is any random string you invent. It guards `/run` and `/preview`.

```bash
openssl rand -hex 24
```

### 6. Test locally without committing

```bash
cp .dev.vars.example .dev.vars    # paste GH_TOKEN and RUN_KEY, keep DRY_RUN=true
pnpm dev
```

In another terminal:

```bash
# fire the cron handler
curl "http://localhost:8787/__scheduled?cron=30+6+*+*+*"
# or see the rendered SVG with live data
open "http://localhost:8787/preview?key=<RUN_KEY>"
```

Recent Wrangler versions also expose the cron handler at `/cdn-cgi/handler/scheduled`. With `DRY_RUN=true` nothing is written to GitHub.

### 7. Store the secrets in Cloudflare and deploy

```bash
pnpm wrangler secret put GH_TOKEN
pnpm wrangler secret put RUN_KEY
pnpm deploy
```

The deploy output prints the URL, `https://profile-pulse.<your-subdomain>.workers.dev`, and confirms the cron schedule.

### 8. Run it once for real

```bash
curl "https://profile-pulse.<your-subdomain>.workers.dev/run?key=<RUN_KEY>&dry=1"   # check values
curl "https://profile-pulse.<your-subdomain>.workers.dev/run?key=<RUN_KEY>"         # commit
```

You should see a `chore: refresh profile stats` commit by `profile-pulse` in the profile repo. Watch scheduled runs with `pnpm tail`.

### 9. Push this repo

```bash
git add .
git commit -m "feat: profile-pulse worker"
git push -u origin main
```

### 10. Add it as a submodule of the profile repo

From the profile repo:

```bash
cd ../shreesharma07
git submodule add https://github.com/shreesharma07/profile-pulse.git workers/profile-pulse
git commit -m "chore: add profile-pulse worker as submodule"
git push
```

This writes a `.gitmodules` entry and a pointer to the exact `profile-pulse` commit. The Worker's own commits only touch `assets/`, so they never conflict with the submodule pointer.

### 11. Retire the old workflow

```bash
git rm .github/workflows/profile-stats.yml
git commit -m "chore: move profile stats refresh to Cloudflare Worker"
git push
```

Once `src/render.js` holds your real design, `tools/` can go too if nothing else uses it. Keep `snake.yml` and `profile-3d.yml` on Actions: their solvers need far more than the free plan's 10 ms of CPU, and Actions minutes are free for public repos.

### 12. Optional: deploy on push without Actions

In the Cloudflare dashboard open Workers & Pages → `profile-pulse` → Settings → Builds → Connect, pick `shreesharma07/profile-pulse`, leave the build command empty and set the deploy command to `pnpm wrangler deploy`. Every push to `main` then redeploys the Worker through Cloudflare Workers Builds.

## Working with the submodule

| Task | Command |
| --- | --- |
| Fresh clone with the Worker included | `git clone --recurse-submodules https://github.com/shreesharma07/shreesharma07.git` |
| Fetch submodule after a plain clone | `git submodule update --init --recursive` |
| Pull the latest Worker code into the profile repo | `git submodule update --remote --merge workers/profile-pulse` then commit the pointer |
| Edit the Worker from inside the profile repo | `cd workers/profile-pulse && git switch main`, edit, commit, push, then `cd ../..` and commit the new pointer |
| See which Worker commit the profile repo pins | `git submodule status` |
| Remove the submodule | `git submodule deinit -f workers/profile-pulse && git rm -f workers/profile-pulse && rm -rf .git/modules/workers/profile-pulse` |

A submodule checks out a detached HEAD by default, so run `git switch main` inside it before making changes.

## Command reference

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local Worker with the cron test route (`wrangler dev --test-scheduled`) |
| `pnpm deploy` | Deploys the Worker and its cron schedule |
| `pnpm deploy:dry` | Bundles to `dist/` without deploying, to check the build |
| `pnpm tail` | Streams live logs, including each cron run's result |
| `pnpm secrets` | Lists secret names stored on the Worker |
| `pnpm whoami` | Shows the logged in Cloudflare account |
| `pnpm wrangler secret put <NAME>` | Adds or rotates a secret |
| `pnpm wrangler secret delete <NAME>` | Removes a secret |
| `pnpm wrangler deployments list` | Deployment history |
| `pnpm wrangler rollback` | Rolls back to the previous deployment |

## HTTP routes

| Route | Auth | Result |
| --- | --- | --- |
| `GET /health` | none | `{"ok":true}` |
| `GET /run?key=…` | `RUN_KEY` | Fetch, render and commit if changed; returns JSON |
| `GET /run?key=…&dry=1` | `RUN_KEY` | Same, without committing |
| `GET /preview?key=…` | `RUN_KEY` | Returns the freshly rendered SVG, no commit |

Every other path, and any request with a wrong or missing key, returns 404.

## Configuration

Plain variables live in `wrangler.toml` under `[vars]`; secrets are set with `wrangler secret put`.

| Name | Kind | Default | Meaning |
| --- | --- | --- | --- |
| `GH_OWNER` | var | `shreesharma07` | GitHub user whose metrics are fetched and who owns the target repo |
| `GH_REPO` | var | `shreesharma07` | Repo the files are committed to |
| `GH_BRANCH` | var | `main` | Branch to commit to |
| `STATS_JSON_PATH` | var | `assets/stats.json` | Path of the stored values |
| `STATS_SVG_PATH` | var | `assets/stats.svg` | Path of the rendered strip |
| `WAKATIME_JSON_URL` | var | empty | Public WakaTime share JSON URL; empty keeps the last value |
| `DRY_RUN` | var | `false` | `true` disables all commits |
| `GH_TOKEN` | secret | | Fine-grained PAT, profile repo only, Contents read and write |
| `RUN_KEY` | secret | | Random string for `/run` and `/preview` |

To change the schedule, edit `crons` in `wrangler.toml` and deploy. Cron expressions are UTC; `30 6 * * *` is 12:00 IST.

## Free plan limits that matter

The Workers free plan gives 10 ms of CPU per cron run (network waits don't count), 50 subrequests per run and 5 cron triggers per account. A normal run uses roughly 1 ms of CPU and about 9 subrequests, so there is plenty of headroom. Keep `render.js` a plain string builder; heavy rendering libraries will exceed the CPU limit.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `GitHub … HTTP 401` | `GH_TOKEN` expired or wrong; create a new one and `wrangler secret put GH_TOKEN` |
| `GitHub … HTTP 403` or `404` on `/git/…` | Token lacks Contents write, or doesn't include the profile repo |
| `HTTP 422` after retries | `main` is moving very fast or is a protected branch requiring PRs; allow the token or relax the rule for `assets/` |
| `Exceeded CPU Time Limits` in the dashboard | Rendering got too heavy; simplify `render.js` |
| A metric shows `n/a` | It has never been fetched successfully; check `failures` in the `/run?dry=1` response |
| Profile still shows old numbers | GitHub's image proxy caches; wait or hard refresh, the commit is what matters |
| No cron runs | Check Workers & Pages → `profile-pulse` → Settings → Triggers, and `pnpm tail` at the scheduled time |
PULSE_EOF
````

Confirm everything is in place and the JavaScript parses:

```bash
find . -type f -not -path './.git/*' | sort
node --check src/index.js && node --check src/metrics.js \
  && node --check src/render.js && node --check src/github.js && echo "files OK"
```

## 5. Install and log in

```bash
pnpm install          # installs wrangler, creates pnpm-lock.yaml
pnpm wrangler login   # opens the browser to authorise your Cloudflare account
pnpm whoami           # shows the account wrangler will deploy to
```

No Cloudflare API key is needed; `wrangler login` handles authorisation.

## 6. Create the secrets

The Worker needs two secrets.

**`GH_TOKEN`** lets the Worker commit to the profile repo. On GitHub open Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token, then set:

| Field | Value |
| --- | --- |
| Token name | `profile-pulse` |
| Expiration | 1 year (set a reminder to rotate) |
| Repository access | Only select repositories → `shreesharma07/shreesharma07` |
| Repository permissions → Contents | Read and write |
| Everything else | No access |

Copy the token; GitHub shows it once.

**`RUN_KEY`** is a random string you make up. It guards the manual `/run` and `/preview` routes:

```bash
openssl rand -hex 24
```

Create the local secrets file:

```bash
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` and paste both values. Keep `DRY_RUN=true` so local runs never commit:

```text
GH_TOKEN=github_pat_...
RUN_KEY=3f9c...
DRY_RUN=true
```

`.dev.vars` is git-ignored. Check it never gets staged:

```bash
git check-ignore .dev.vars && echo "ignored, good"
```

## 7. Test locally

Start the Worker:

```bash
pnpm dev
```

In a second terminal:

```bash
# health check
curl http://localhost:8787/health

# trigger the cron handler exactly as Cloudflare would
curl "http://localhost:8787/__scheduled?cron=30+6+*+*+*"
# newer Wrangler versions also accept:
curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=30+6+*+*+*"

# full run as JSON, never commits
curl "http://localhost:8787/run?key=<RUN_KEY>&dry=1"

# rendered SVG with live data
curl -o /tmp/stats-preview.svg "http://localhost:8787/preview?key=<RUN_KEY>"
```

Open `/tmp/stats-preview.svg` in a browser, or visit `http://localhost:8787/preview?key=<RUN_KEY>` directly. The cron result appears in the `pnpm dev` terminal. In the `/run` JSON, `metrics` holds the values and `failures` lists any source that could not be fetched.

Stop the dev server with `Ctrl+C` when done.

## 8. Deploy to Cloudflare

Store the production secrets (paste each when prompted):

```bash
pnpm wrangler secret put GH_TOKEN
pnpm wrangler secret put RUN_KEY
pnpm secrets            # lists GH_TOKEN and RUN_KEY
```

`DRY_RUN` in production comes from `wrangler.toml`, where it is `"false"`. Deploy:

```bash
pnpm deploy
```

The output shows the Worker URL, `https://profile-pulse.<your-subdomain>.workers.dev`, and the schedule `30 6 * * *`. Keep the URL handy:

```bash
export PULSE_URL="https://profile-pulse.<your-subdomain>.workers.dev"
export RUN_KEY="<your RUN_KEY>"
```

## 9. First real run

```bash
curl "$PULSE_URL/health"
curl "$PULSE_URL/run?key=$RUN_KEY&dry=1"     # check the values first
curl "$PULSE_URL/run?key=$RUN_KEY"           # commits if anything changed
```

A successful commit returns `"committed": true` with the commit `sha`. On GitHub, the profile repo now has a `chore: refresh profile stats` commit by `profile-pulse`. To watch scheduled runs live:

```bash
pnpm tail
```

## 10. Push profile-pulse

```bash
cd ~/code/profile-pulse
git add .
git status            # .dev.vars and node_modules must NOT be listed
git commit -m "feat: profile-pulse worker"
git push -u origin main
```

## 11. Add it as a submodule of the profile repo

Clone the profile repo next to profile-pulse if it is not already local:

```bash
cd ~/code
git clone https://github.com/shreesharma07/shreesharma07.git
cd shreesharma07
git pull --rebase          # pick up the Worker's first commit from step 9
```

Add the submodule:

```bash
git submodule add -b main https://github.com/shreesharma07/profile-pulse.git workers/profile-pulse
```

`-b main` records the branch in `.gitmodules`, so `git submodule update --remote` later knows what to follow. Check what was created:

```bash
cat .gitmodules
git submodule status
```

`.gitmodules` should read:

```ini
[submodule "workers/profile-pulse"]
 path = workers/profile-pulse
 url = https://github.com/shreesharma07/profile-pulse.git
 branch = main
```

Commit and push:

```bash
git add .gitmodules workers/profile-pulse
git commit -m "chore: add profile-pulse worker as submodule"
git push
```

The Worker's own commits only touch `assets/stats.json` and `assets/stats.svg`, so they never conflict with the submodule pointer.

## 12. Retire the old stats workflow

Still in the profile repo:

```bash
git rm .github/workflows/profile-stats.yml
git commit -m "chore: move profile stats refresh to Cloudflare Worker"
git push
```

Keep `snake.yml` and `profile-3d.yml`. Their generators need far more CPU than the Workers free plan's 10 ms, and Actions minutes are free for public repos.

The `tools/` folder (`build-profile.mjs` and its `package.json`) was only used by the stats workflow. Once you have copied its SVG design into `workers/profile-pulse/src/render.js` and its profile views source into `src/metrics.js` (if it differs from the komarev counter), remove it:

```bash
git rm -r tools
git commit -m "chore: remove local stats builder, now in profile-pulse"
git push
```

## 13. Verify everything

```bash
# profile repo has the submodule at the right commit
cd ~/code/shreesharma07
git submodule status

# a fresh clone pulls the Worker code too
cd /tmp && rm -rf profile-check
git clone --recurse-submodules https://github.com/shreesharma07/shreesharma07.git profile-check
ls profile-check/workers/profile-pulse/src

# Worker is live and the cron is registered
curl "$PULSE_URL/health"
cd ~/code/profile-pulse && pnpm wrangler deployments list
```

In the Cloudflare dashboard, Workers & Pages → `profile-pulse` → Settings → Triggers should list `30 6 * * *`. On github.com the profile repo shows `workers/profile-pulse @ <sha>` as a link to the profile-pulse repo.

## 14. Day to day workflow

**Change the Worker from its own clone (recommended):**

```bash
cd ~/code/profile-pulse
git pull
# edit src/...
pnpm dev                                   # test with DRY_RUN=true
pnpm deploy
git add . && git commit -m "feat: ..." && git push

# move the profile repo's pointer to the new commit
cd ~/code/shreesharma07
git pull --rebase
git submodule update --remote --merge workers/profile-pulse
git add workers/profile-pulse
git commit -m "chore: bump profile-pulse"
git push
```

**Change the Worker from inside the profile repo:**

```bash
cd ~/code/shreesharma07/workers/profile-pulse
git switch main             # submodules start on a detached HEAD
git pull
pnpm install
cp .dev.vars.example .dev.vars   # once, then fill in the values
# edit, test, deploy as above
git add . && git commit -m "feat: ..." && git push
cd ../..
git add workers/profile-pulse
git commit -m "chore: bump profile-pulse"
git push
```

**Pull everything on another machine:**

```bash
git clone --recurse-submodules https://github.com/shreesharma07/shreesharma07.git
# or, in an existing clone
git pull --recurse-submodules
git submodule update --init --recursive
```

To make plain `git pull` always update submodules too:

```bash
git config --global submodule.recurse true
```

**Rotate the GitHub token before it expires:**

```bash
cd ~/code/profile-pulse
pnpm wrangler secret put GH_TOKEN     # paste the new token
```

Also update `.dev.vars` locally.

**Change the schedule:** edit `crons` in `wrangler.toml` (UTC; `30 6 * * *` is 12:00 IST), then `pnpm deploy`.

## 15. Optional: auto deploy on push

Cloudflare Workers Builds can redeploy on every push to `profile-pulse` without GitHub Actions. In the dashboard open Workers & Pages → `profile-pulse` → Settings → Builds → Connect, choose `shreesharma07/profile-pulse`, branch `main`, leave the build command empty and set the deploy command to:

```bash
pnpm wrangler deploy
```

Secrets set with `wrangler secret put` stay in place across these deploys.

## 16. Command reference

### pnpm scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local Worker with the cron test route (`wrangler dev --test-scheduled`) |
| `pnpm deploy` | Deploys the Worker and its cron schedule |
| `pnpm deploy:dry` | Bundles into `dist/` without deploying |
| `pnpm tail` | Streams live logs, including each cron result |
| `pnpm secrets` | Lists secret names on the deployed Worker |
| `pnpm whoami` | Shows the logged in Cloudflare account |

### Wrangler

| Command | What it does |
| --- | --- |
| `pnpm wrangler login` / `logout` | Authorise or remove the Cloudflare login |
| `pnpm wrangler secret put <NAME>` | Add or rotate a secret |
| `pnpm wrangler secret delete <NAME>` | Remove a secret |
| `pnpm wrangler dev --remote` | Run the dev server on Cloudflare's network instead of locally |
| `pnpm wrangler dev --port 8788` | Use another local port |
| `pnpm wrangler deployments list` | Deployment history |
| `pnpm wrangler rollback` | Roll back to the previous deployment |
| `pnpm wrangler delete` | Delete the Worker entirely |

### Worker routes

| Route | Auth | Result |
| --- | --- | --- |
| `GET /health` | none | `{"ok":true}` |
| `GET /run?key=…` | `RUN_KEY` | Fetch, render, commit if changed; JSON result |
| `GET /run?key=…&dry=1` | `RUN_KEY` | Same, never commits |
| `GET /preview?key=…` | `RUN_KEY` | Rendered SVG, never commits |

Any other path, or a missing or wrong key, returns 404.

### Git submodule

| Task | Command |
| --- | --- |
| Add | `git submodule add -b main <url> workers/profile-pulse` |
| Initialise after a plain clone | `git submodule update --init --recursive` |
| Follow the latest `main` | `git submodule update --remote --merge workers/profile-pulse` |
| Show pinned commit | `git submodule status` |
| Run a command in every submodule | `git submodule foreach 'git status'` |
| Change the remote URL | edit `.gitmodules`, then `git submodule sync` |
| Remove | `git submodule deinit -f workers/profile-pulse && git rm -f workers/profile-pulse && rm -rf .git/modules/workers/profile-pulse` |

### Configuration

| Name | Kind | Default | Meaning |
| --- | --- | --- | --- |
| `GH_OWNER` | var | `shreesharma07` | User whose metrics are fetched and who owns the target repo |
| `GH_REPO` | var | `shreesharma07` | Repo the files are committed to |
| `GH_BRANCH` | var | `main` | Branch to commit to |
| `STATS_JSON_PATH` | var | `assets/stats.json` | Stored values |
| `STATS_SVG_PATH` | var | `assets/stats.svg` | Rendered strip |
| `WAKATIME_JSON_URL` | var | empty | Public WakaTime share JSON URL; empty keeps the last value |
| `DRY_RUN` | var | `false` | `true` disables all commits |
| `GH_TOKEN` | secret | | Fine-grained PAT, profile repo only, Contents read and write |
| `RUN_KEY` | secret | | Random string guarding `/run` and `/preview` |

## 17. Troubleshooting

| Symptom | Fix |
| --- | --- |
| `GH_TOKEN secret is not set` | Fill `.dev.vars` locally, or run `pnpm wrangler secret put GH_TOKEN` |
| `GitHub … HTTP 401` | Token expired or mistyped; create a new one and set it again |
| `GitHub … HTTP 403` or `404` on `/git/…` | Token lacks Contents write, or doesn't include the profile repo |
| `HTTP 422` after retries | `main` is protected and requires pull requests; allow this token or relax the rule |
| `Exceeded CPU Time Limits` in the dashboard | `render.js` got too heavy for the 10 ms free limit; keep it a plain string builder |
| A metric shows `n/a` | It has never fetched successfully; check `failures` in `/run?key=…&dry=1` |
| `/run` returns 404 | Wrong or missing `key`, or `RUN_KEY` not set as a secret |
| Profile image still shows old numbers | GitHub's image proxy caches; the commit is what matters, refresh later |
| Submodule folder is empty after cloning | `git submodule update --init --recursive` |
| `You are in 'detached HEAD' state` inside the submodule | Normal; run `git switch main` before editing |
| Profile repo push rejected after a Worker run | `git pull --rebase` first; the Worker commits to `main` daily |
| No cron runs | Check Settings → Triggers in the dashboard, then `pnpm tail` at 06:30 UTC |
