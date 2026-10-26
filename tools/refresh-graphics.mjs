/**
 * Contribution graphics builder: the local replacement for the snake.yml and
 * profile-3d.yml workflows. Regenerates
 *
 *   assets/profile-snake/snake-dark.svg          (Platane/snk, npm package)
 *   assets/profile-3d-contrib/profile-city.svg   (yoshi389111/github-profile-3d-contrib)
 *
 * with the same options the workflows used. The gh-profile-worker never
 * touches these files; commit and push them yourself, or let
 * tools/cron/refresh-graphics.sh do it on a schedule.
 *
 *   cd tools && npm ci
 *   node refresh-graphics.mjs            both
 *   node refresh-graphics.mjs snake      one of them
 *
 * Needs a GitHub token to read the contribution calendar: GITHUB_TOKEN in the
 * environment, else GITHUB_TOKEN/GH_TOKEN from tools/.env, else GH_TOKEN from
 * workers/gh-profile-worker/.env. Any token that can read public profile data works.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CACHE = join(HERE, '.cache');
const USER = 'shreesharma07';

// Same output and palette as .github/workflows/snake.yml.
const SNAKE = {
  out: join(ROOT, 'assets', 'profile-snake', 'snake-dark.svg'),
  options: 'palette=github-dark&color_snake=#58a6ff',
};

// Same release as .github/workflows/profile-3d.yml, pinned to the tag's commit so a
// moved tag can never change the code that runs with your token.
const CITY = {
  repo: 'https://github.com/yoshi389111/github-profile-3d-contrib.git',
  tag: 'v0.9.3',
  commit: '7d95e7d4cdc028dd1e1cbd957d65f35efb12ae39',
  settings: join(ROOT, '.github', 'profile-3d-settings.json'),
  file: 'profile-city.svg',
  out: join(ROOT, 'assets', 'profile-3d-contrib', 'profile-city.svg'),
};

function readToken() {
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, from: 'GITHUB_TOKEN' };
  for (const file of [join(HERE, '.env'), join(ROOT, 'workers', 'gh-profile-worker', '.env')]) {
    if (!existsSync(file)) continue;
    const vars = parseEnv(readFileSync(file, 'utf8'));
    const token = vars.GITHUB_TOKEN || vars.GH_TOKEN;
    if (token) return { token, from: file };
  }
  throw new Error('no GitHub token: set GITHUB_TOKEN, or put it in tools/.env');
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited with ${res.status}`);
}

/** Replace `dest` only with a non-empty file, so a failed run never blanks an image. */
function install(src, dest) {
  if (!existsSync(src) || statSync(src).size === 0) throw new Error(`generator produced no ${src}`);
  const before = existsSync(dest) ? readFileSync(dest) : null;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, `${dest}.tmp`);
  renameSync(`${dest}.tmp`, dest);
  return before === null || !before.equals(readFileSync(dest));
}

function snake(token) {
  const cli = fileURLToPath(import.meta.resolve('generate-snake-animation/cli.js'));
  const work = mkdtempSync(join(tmpdir(), 'snake-'));
  try {
    const file = join(work, 'snake-dark.svg');
    run(process.execPath, [cli, '--github_user', USER, '--output', `${file}?${SNAKE.options}`], {
      env: { ...process.env, GITHUB_TOKEN: token },
    });
    return install(file, SNAKE.out);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Shallow clone of the pinned release; its committed dist/index.js is a self-contained bundle. */
function cityCheckout() {
  const dir = join(CACHE, `github-profile-3d-contrib-${CITY.tag}`);
  if (!existsSync(join(dir, 'dist', 'index.js'))) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(CACHE, { recursive: true });
    run('git', ['-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', CITY.tag, CITY.repo, dir]);
  }
  const head = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  if (head !== CITY.commit) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error(`${CITY.repo}@${CITY.tag} is ${head}, expected ${CITY.commit}; refusing to run it`);
  }
  return dir;
}

function city(token) {
  const bundle = join(cityCheckout(), 'dist', 'index.js');
  // The generator always writes to ./profile-3d-contrib under its working directory.
  const work = mkdtempSync(join(tmpdir(), 'city-'));
  try {
    run(process.execPath, [bundle, USER], {
      cwd: work,
      env: { ...process.env, GITHUB_TOKEN: token, USERNAME: USER, SETTING_JSON: CITY.settings },
    });
    return install(join(work, 'profile-3d-contrib', CITY.file), CITY.out);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

const JOBS = { snake, city };
const wanted = process.argv.slice(2);
for (const name of wanted) if (!(name in JOBS)) throw new Error(`unknown graphic "${name}"; use: ${Object.keys(JOBS).join(', ')}`);

const { token, from } = readToken();
console.log(`token from ${from}`);
let failed = false;
for (const name of wanted.length ? wanted : Object.keys(JOBS)) {
  try {
    console.log(`${name}: ${JOBS[name](token) ? 'updated' : 'unchanged'}`);
  } catch (e) {
    failed = true;
    console.error(`${name}: failed: ${e.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
