/**
 * Profile README builder.
 *
 * Renders the SVG assets (hero, section headers, principles, impact tiles,
 * career timeline, role cards, project cards, roadmap, education, footer)
 * with Space Grotesk + JetBrains Mono embedded as per-file woff2 subsets,
 * then writes ../README.md. GitHub strips <style> and webfont links from
 * README HTML, so SVG with embedded fonts is the only way to get Google
 * Fonts onto a profile page.
 *
 *   cd tools && npm install && npm run build
 *
 * Edit the DATA section below, never the generated README directly.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';
import { Blob, Buffer as HbBuffer, Face, Font, Variation, shape } from 'harfbuzzjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ASSETS = join(ROOT, 'assets');
const CACHE = join(HERE, '.cache');

// ───────────────────────────── palette (GitHub Primer dark) ─────────────────────────────
const C = {
  bg: '#0d1117', surface: '#161b22', raised: '#1c2128', border: '#30363d', hair: '#21262d',
  text: '#e6edf3', muted: '#8b949e', faint: '#6e7681',
  blue: '#58a6ff', blueDeep: '#1f6feb', purple: '#a371f7', purpleDeep: '#8957e5',
  green: '#3fb950', orange: '#f0883e', pink: '#f778ba', yellow: '#e3b341', red: '#ff7b72',
};

// ═════════════════════════════ DATA ═════════════════════════════
const PROFILE = {
  name: 'Shri Kumar Sharma',
  github: 'shreesharma07',
  role: 'Backend Engineer · SDE-3',
  website: 'https://www.shrikumarsharma.in/',
  blog: 'https://blogs.shrikumarsharma.in/',
  email: 'shrikumarsharma1998@gmail.com',
  linkedin: 'https://www.linkedin.com/in/shreesharma07/',
  experienceUrl: 'https://www.linkedin.com/in/shreesharma07/details/experience/',
  onecx: 'https://one-cx.com/',
  udemyCert: 'https://www.udemy.com/certificate/UC-d7b054d4-41cc-4fc3-8abf-9bd2306078db/',
  instagram: 'https://www.instagram.com/shree_kumar_sharma/',
  uptimeBadge: 'https://badge.uptimerobot.com/psp/ac0ed1a5dc4eb81afa89938ca9cb4d2f.svg?style=logo&theme=dark',
  uptimePage: 'https://stats.uptimerobot.com/NHUuWcHbD1?utm_source=status_badge&utm_medium=referral',
  wakatimeId: 'd4ee9b09-006e-483f-b384-7fdc23c8b1ad',
  wakatimeShares: {
    pie: 'https://wakatime.com/share/@shreesharma07/e0ad4b50-231a-44cf-ad7b-a4653f66ed61.png',
    bar: 'https://wakatime.com/share/@shreesharma07/fcf6c83b-1dbc-456b-bff4-e0ead4e41e39.png',
    activity: 'https://wakatime.com/share/@shreesharma07/29db582f-a9d9-4742-926e-5d82787f1757.svg',
  },
};

/**
 * Every chip and icon on the page resolves through this table, so each one
 * carries its official link. `logo` is a simple-icons slug; slugs listed in
 * LEGACY_LOGOS were removed upstream and are embedded from simple-icons v8/v9.
 * `icon` is the skillicons.dev id, where one exists.
 */
const TECH = {
  // languages & runtimes
  typescript: { label: 'TypeScript', logo: 'typescript', color: '3178C6', href: 'https://www.typescriptlang.org', icon: 'ts' },
  javascript: { label: 'JavaScript', logo: 'javascript', color: 'F7DF1E', href: 'https://developer.mozilla.org/docs/Web/JavaScript', icon: 'js' },
  nodejs: { label: 'Node.js', logo: 'nodedotjs', color: '5FA04E', href: 'https://nodejs.org', icon: 'nodejs' },
  bash: { label: 'Bash', logo: 'gnubash', color: '4EAA25', href: 'https://www.gnu.org/software/bash/', icon: 'bash' },
  // backend & apis
  nestjs: { label: 'NestJS', logo: 'nestjs', color: 'E0234E', href: 'https://nestjs.com', icon: 'nestjs' },
  express: { label: 'Express.js', logo: 'express', color: 'FFFFFF', href: 'https://expressjs.com', icon: 'express' },
  graphql: { label: 'GraphQL', logo: 'graphql', color: 'E10098', href: 'https://graphql.org', icon: 'graphql' },
  // simple-icons has no gRPC mark; the chip is text-only rather than borrowing another brand's logo
  grpc: { label: 'gRPC', logo: null, color: '4DB6AC', href: 'https://grpc.io' },
  socketio: { label: 'Socket.IO', logo: 'socketdotio', color: 'FFFFFF', href: 'https://socket.io' },
  openapi: { label: 'REST · OpenAPI', logo: 'openapiinitiative', color: '6BA539', href: 'https://www.openapis.org' },
  whatsapp: { label: 'WhatsApp API', logo: 'whatsapp', color: '25D366', href: 'https://developers.facebook.com/docs/whatsapp' },
  postman: { label: 'Postman', logo: 'postman', color: 'FF6C37', href: 'https://www.postman.com', icon: 'postman' },
  // data
  postgres: { label: 'PostgreSQL', logo: 'postgresql', color: '4169E1', href: 'https://www.postgresql.org', icon: 'postgres' },
  mysql: { label: 'MySQL', logo: 'mysql', color: '4479A1', href: 'https://www.mysql.com', icon: 'mysql' },
  mongodb: { label: 'MongoDB', logo: 'mongodb', color: '47A248', href: 'https://www.mongodb.com', icon: 'mongodb' },
  sqlite: { label: 'SQLite', logo: 'sqlite', color: '4FA3D9', href: 'https://www.sqlite.org', icon: 'sqlite' },
  cassandra: { label: 'Cassandra', logo: 'apachecassandra', color: '1287B1', href: 'https://cassandra.apache.org', icon: 'cassandra' },
  rds: { label: 'AWS RDS', logo: 'amazonrds', color: '527FFF', href: 'https://aws.amazon.com/rds/' },
  redshift: { label: 'Redshift', logo: 'amazonredshift', color: '8C4FFF', href: 'https://aws.amazon.com/redshift/' },
  typeorm: { label: 'TypeORM', logo: 'typeorm', color: 'FE0803', href: 'https://typeorm.io' },
  prisma: { label: 'Prisma', logo: 'prisma', color: 'FFFFFF', href: 'https://www.prisma.io', icon: 'prisma' },
  zod: { label: 'Zod', logo: 'zod', color: '3E67B1', href: 'https://zod.dev' },
  firebase: { label: 'Firebase', logo: 'firebase', color: 'DD2C00', href: 'https://firebase.google.com', icon: 'firebase' },
  // messaging, cache, search
  kafka: { label: 'Kafka', logo: 'apachekafka', color: 'FFFFFF', href: 'https://kafka.apache.org', icon: 'kafka' },
  rabbitmq: { label: 'RabbitMQ', logo: 'rabbitmq', color: 'FF6600', href: 'https://www.rabbitmq.com', icon: 'rabbitmq' },
  bullmq: { label: 'BullMQ', logo: 'redis', color: 'E5484D', href: 'https://bullmq.io' },
  redis: { label: 'Redis', logo: 'redis', color: 'FF4438', href: 'https://redis.io', icon: 'redis' },
  pubsub: { label: 'Redis Pub/Sub', logo: 'redis', color: 'DC382D', href: 'https://redis.io/docs/latest/develop/interact/pubsub/' },
  elasticsearch: { label: 'Elasticsearch', logo: 'elasticsearch', color: '00BFB3', href: 'https://www.elastic.co/elasticsearch', icon: 'elasticsearch' },
  kibana: { label: 'Kibana', logo: 'kibana', color: 'E8478B', href: 'https://www.elastic.co/kibana' },
  // cloud & delivery
  aws: { label: 'AWS', logo: 'amazonaws', color: 'FF9900', href: 'https://aws.amazon.com', icon: 'aws' },
  lambda: { label: 'Lambda', logo: 'awslambda', color: 'FF9900', href: 'https://aws.amazon.com/lambda/' },
  cloudwatch: { label: 'CloudWatch', logo: 'amazoncloudwatch', color: 'FF4F8B', href: 'https://aws.amazon.com/cloudwatch/' },
  docker: { label: 'Docker', logo: 'docker', color: '2496ED', href: 'https://www.docker.com', icon: 'docker' },
  nginx: { label: 'Nginx', logo: 'nginx', color: '009639', href: 'https://nginx.org', icon: 'nginx' },
  linux: { label: 'Linux', logo: 'linux', color: 'FCC624', href: 'https://www.kernel.org', icon: 'linux' },
  pm2: { label: 'PM2', logo: 'pm2', color: 'FFFFFF', href: 'https://pm2.keymetrics.io' },
  linode: { label: 'Linode', logo: 'linode', color: '00A95C', href: 'https://www.linode.com' },
  vercel: { label: 'Vercel', logo: 'vercel', color: 'FFFFFF', href: 'https://vercel.com', icon: 'vercel' },
  actions: { label: 'GitHub Actions', logo: 'githubactions', color: '2088FF', href: 'https://github.com/features/actions', icon: 'githubactions' },
  circleci: { label: 'CircleCI', logo: 'circleci', color: 'FFFFFF', href: 'https://circleci.com' },
  ado: { label: 'Azure DevOps', logo: 'azuredevops', color: '0078D7', href: 'https://azure.microsoft.com/products/devops' },
  husky: { label: 'Husky', logo: 'git', color: 'F05032', href: 'https://typicode.github.io/husky/' },
  prometheus: { label: 'Prometheus', logo: 'prometheus', color: 'E6522C', href: 'https://prometheus.io', icon: 'prometheus' },
  grafana: { label: 'Grafana', logo: 'grafana', color: 'F46800', href: 'https://grafana.com', icon: 'grafana' },
  // testing & security
  jest: { label: 'Jest', logo: 'jest', color: 'C21325', href: 'https://jestjs.io', icon: 'jest' },
  vitest: { label: 'Vitest', logo: 'vitest', color: 'FCC72B', href: 'https://vitest.dev', icon: 'vitest' },
  playwright: { label: 'Playwright', logo: 'playwright', color: '2EAD33', href: 'https://playwright.dev', icon: 'playwright' },
  jwt: { label: 'JWT', logo: 'jsonwebtokens', color: 'FFFFFF', href: 'https://jwt.io' },
  oauth: { label: 'OAuth 2.0', logo: 'auth0', color: 'EB5424', href: 'https://oauth.net/2/' },
  // tooling
  git: { label: 'Git', logo: 'git', color: 'F05032', href: 'https://git-scm.com', icon: 'git' },
  github: { label: 'GitHub', logo: 'github', color: 'FFFFFF', href: 'https://github.com', icon: 'github' },
  gitlab: { label: 'GitLab', logo: 'gitlab', color: 'FC6D26', href: 'https://gitlab.com', icon: 'gitlab' },
  bitbucket: { label: 'Bitbucket', logo: 'bitbucket', color: '2684FF', href: 'https://bitbucket.org', icon: 'bitbucket' },
  jira: { label: 'Jira', logo: 'jira', color: '2684FF', href: 'https://www.atlassian.com/software/jira' },
  mermaid: { label: 'Mermaid', logo: 'mermaid', color: 'FF3670', href: 'https://mermaid.js.org' },
  figma: { label: 'Figma', logo: 'figma', color: 'F24E1E', href: 'https://www.figma.com', icon: 'figma' },
  // ai-assisted
  claude: { label: 'Claude Code', logo: 'claude', color: 'D97757', href: 'https://claude.com/product/claude-code' },
  mcp: { label: 'MCP', logo: 'modelcontextprotocol', color: 'FFFFFF', href: 'https://modelcontextprotocol.io' },
  copilot: { label: 'Copilot', logo: 'githubcopilot', color: 'FFFFFF', href: 'https://github.com/features/copilot' },
  cursor: { label: 'Cursor', logo: 'cursor', color: 'FFFFFF', href: 'https://cursor.com' },
  // frontend I have shipped with
  react: { label: 'React', logo: 'react', color: '61DAFB', href: 'https://react.dev', icon: 'react' },
  nextjs: { label: 'Next.js', logo: 'nextdotjs', color: 'FFFFFF', href: 'https://nextjs.org', icon: 'nextjs' },
  tailwind: { label: 'Tailwind', logo: 'tailwindcss', color: '06B6D4', href: 'https://tailwindcss.com', icon: 'tailwind' },
  bootstrap: { label: 'Bootstrap', logo: 'bootstrap', color: '7952B3', href: 'https://getbootstrap.com', icon: 'bootstrap' },
  // ambitions
  rust: { label: 'Rust', logo: 'rust', color: 'FFFFFF', href: 'https://www.rust-lang.org', icon: 'rust' },
  go: { label: 'Go', logo: 'go', color: '00ADD8', href: 'https://go.dev', icon: 'go' },
  spring: { label: 'Spring Boot', logo: 'springboot', color: '6DB33F', href: 'https://spring.io/projects/spring-boot', icon: 'spring' },
  kubernetes: { label: 'Kubernetes', logo: 'kubernetes', color: '326CE5', href: 'https://kubernetes.io', icon: 'kubernetes' },
  terraform: { label: 'Terraform', logo: 'terraform', color: '844FBA', href: 'https://developer.hashicorp.com/terraform', icon: 'terraform' },
  helm: { label: 'Helm', logo: 'helm', color: 'FFFFFF', href: 'https://helm.sh' },
  argocd: { label: 'Argo CD', logo: 'argo', color: 'EF7B4D', href: 'https://argo-cd.readthedocs.io' },
  searchconsole: { label: 'Search Console', logo: 'googlesearchconsole', color: '458CF5', href: 'https://search.google.com/search-console/about' },
  lighthouse: { label: 'Lighthouse', logo: 'lighthouse', color: 'F44B21', href: 'https://developer.chrome.com/docs/lighthouse/overview' },
  cwv: { label: 'Core Web Vitals', logo: 'googlechrome', color: '4285F4', href: 'https://web.dev/articles/vitals' },
  // web, analytics & seo
  astro: { label: 'Astro', logo: 'astro', color: 'FF5D01', href: 'https://astro.build', icon: 'astro' },
  cloudflare: { label: 'Cloudflare', logo: 'cloudflare', color: 'F38020', href: 'https://www.cloudflare.com', icon: 'cloudflare' },
  analytics: { label: 'Google Analytics', logo: 'googleanalytics', color: 'E37400', href: 'https://marketingplatform.google.com/about/analytics/' },
  posthog: { label: 'PostHog', logo: 'posthog', color: 'F9BD2B', href: 'https://posthog.com' },
};

const LEGACY_LOGOS = ['amazonaws', 'awslambda', 'amazonrds', 'amazonredshift', 'amazoncloudwatch', 'azuredevops', 'linkedin', 'linode', 'playwright'];

/** Page order. The coding-first block comes before the "more about me" resume block. */
const SECTIONS = [
  { id: 'summary', title: 'The Short Version', cmd: 'whoami --verbose', accent: C.blue },
  { id: 'primary', title: 'Daily Drivers', cmd: 'cat package.json', accent: C.purple },
  { id: 'coding', title: 'Proof of Work', cmd: 'gh api users/shreesharma07', accent: C.green },
  { id: 'wakatime', title: 'Time at the Keyboard', cmd: 'wakatime --all-time', accent: C.blue },
  { id: 'connect', title: 'Open a Connection', cmd: 'ping shri', accent: C.pink },
  { id: 'experience', title: "Where I've Shipped", cmd: 'cat experience.md', accent: C.blue },
  { id: 'projects', title: "Systems I've Built", cmd: 'ls ~/projects --featured', accent: C.orange },
  { id: 'skills', title: 'The Full Toolbox', cmd: 'pnpm ls --depth=0', accent: C.purple },
  { id: 'ambitions', title: 'The Next Release', cmd: 'git checkout -b next', accent: C.pink },
  { id: 'impact', title: 'Numbers in Production', cmd: 'SELECT impact FROM prod;', accent: C.green },
  { id: 'timeline', title: 'The Long Version', cmd: 'git log --graph --career', accent: C.purple },
  { id: 'milestones', title: 'Tagged Releases', cmd: 'git tag --list', accent: C.yellow },
  { id: 'credentials', title: 'Recognition & Certifications', cmd: 'cat credentials.json', accent: C.yellow },
  { id: 'education', title: 'Where It Started', cmd: 'history | grep learn', accent: C.orange },
  { id: 'languages', title: 'Human Languages', cmd: 'locale -a', accent: C.green },
  { id: 'support', title: 'Fuel the Build', cmd: 'sudo make coffee', accent: C.pink },
];

/** Non-numbered banners between the page's three blocks. */
const SEPARATORS = [
  { id: 'more', eyebrow: 'MORE ABOUT ME', caption: 'experience · projects · skills · impact · timeline · credentials', accent: C.purple },
  { id: 'last', eyebrow: 'BEFORE YOU GO', caption: 'thanks for reading this far', accent: C.pink },
];

/** Key Tech Stack: the daily drivers, shown as an icon grid (skillicons ids via TECH). */
const PRIMARY_STACK = [
  'typescript', 'nodejs', 'nestjs', 'express', 'graphql', 'postgres', 'mongodb', 'redis', 'kafka', 'rabbitmq',
  'elasticsearch', 'prisma', 'aws', 'cloudflare', 'docker', 'actions', 'prometheus', 'grafana', 'vitest', 'astro',
];

/** Tech & Skills: the full listing, one card per group. */
const SKILL_GROUPS = [
  { title: 'Backend & APIs', color: C.blue, keys: ['nodejs', 'typescript', 'javascript', 'nestjs', 'express', 'graphql', 'grpc', 'socketio', 'openapi', 'whatsapp', 'postman'] },
  { title: 'Databases & ORMs', color: C.green, keys: ['postgres', 'mysql', 'mongodb', 'sqlite', 'cassandra', 'rds', 'redshift', 'typeorm', 'prisma', 'zod', 'firebase'] },
  { title: 'Messaging & search', color: C.orange, keys: ['kafka', 'rabbitmq', 'bullmq', 'redis', 'pubsub', 'elasticsearch', 'kibana'] },
  { title: 'Cloud & delivery', color: C.purple, keys: ['aws', 'lambda', 'cloudwatch', 'docker', 'nginx', 'pm2', 'linode', 'vercel', 'actions', 'circleci', 'ado', 'husky'] },
  { title: 'Observability & testing', color: C.pink, keys: ['prometheus', 'grafana', 'jest', 'vitest', 'playwright', 'jwt', 'oauth'] },
  { title: 'Web, analytics & SEO', color: C.yellow, keys: ['astro', 'cloudflare', 'analytics', 'posthog', 'searchconsole'] },
  { title: 'Tooling', color: C.blue, keys: ['git', 'github', 'gitlab', 'bitbucket', 'jira', 'mermaid', 'figma'] },
  { title: 'AI-assisted', color: C.orange, keys: ['claude', 'mcp', 'copilot', 'cursor'] },
  { title: 'Also shipped with', color: C.green, keys: ['react', 'nextjs', 'tailwind', 'bootstrap'] },
];

const PRINCIPLES = [
  { title: 'Own the full backend', body: 'Schema, APIs, queues, sockets, deploys and monitoring, design to on-call.', color: C.blue },
  { title: 'Design with the client', body: 'Feature scope and high-level design agreed before the build starts.', color: C.purple },
  { title: 'Prove it with a POC', body: 'Approach, cost and failure modes settled before committing.', color: C.green },
  { title: 'Write it down', body: 'Scope, effort and trade-offs in writing; architecture in Mermaid.', color: C.orange },
];

const IMPACT = [
  { value: '~12M', label: 'dictionary entries indexed', sub: 'Elasticsearch + Redis', color: C.blue },
  { value: '−40%', label: 'search lookup latency', sub: 'vs. previous implementation', color: C.green },
  { value: '−35%', label: 'API response time', sub: 'BullMQ off the request path', color: C.green },
  { value: '−50%', label: 'time to detect incidents', sub: 'Prometheus + Grafana', color: C.purple },
  { value: '99.9%', label: 'uptime under load', sub: '~100K messages / bot / day', color: C.blue },
  { value: '1M+', label: 'messages per quarter', sub: 'WhatsApp Business API', color: C.orange },
  { value: '10×', label: 'client business reach', sub: 'INTERCOMM platform', color: C.pink },
  { value: '250K', label: 'emails in < 10 minutes', sub: 'bulk email service', color: C.yellow },
];

/** Career periods as fractional years: May 2021 -> 2021 + 4/12. */
const ym = (y, m) => y + (m - 1) / 12;
const TIMELINE = [
  { chip: 'EDU', title: 'Bachelor of Computer Applications', sub: 'GGSIPU · New Delhi', from: ym(2017, 7), to: ym(2020, 7), period: '2017 to 2020', span: '3 yrs', color: C.yellow },
  { chip: 'JR', title: 'Junior Node.js Developer', sub: 'PrepLadder (Unacademy) · Chandigarh', from: ym(2021, 5), to: ym(2022, 8), period: 'May 2021 to Jul 2022', span: '1 yr 3 mo', color: C.green },
  { chip: 'SDE-1', title: 'Software Engineer', sub: 'PrepLadder (Unacademy) · Chandigarh', from: ym(2022, 8), to: ym(2022, 11), period: 'Aug to Oct 2022', span: '3 mo', color: C.green },
  { chip: 'SDE-2', title: 'Software Development Engineer 2', sub: 'OneCX · Gurugram', from: ym(2022, 11), to: ym(2025, 4), period: 'Nov 2022 to Mar 2025', span: '2 yr 5 mo', color: C.purple },
  { chip: 'SDE-3', title: 'Software Development Engineer 3', sub: 'OneCX · Gurugram', from: ym(2025, 4), to: null, period: 'Apr 2025 to Present', span: 'current', color: C.blue },
];
const MILESTONES = [
  { date: '2020', title: 'Graduated', sub: 'BCA from GGSIPU, New Delhi', color: C.yellow },
  { date: 'MAY 2021', title: 'First backend role', sub: 'Junior Node.js Developer at PrepLadder', color: C.green },
  { date: 'Q2 2022', title: 'PrepStar award', sub: 'Best backend performer of the quarter', color: C.orange },
  { date: 'NOV 2022', title: 'Joined OneCX', sub: 'SDE-2 on INTERCOMM and BridgeQ', color: C.purple },
  { date: 'APR 2025', title: 'Promoted to SDE-3', sub: 'Sole backend owner, multiplayer platform', color: C.blue },
];

const EXPERIENCE = [
  {
    id: 'sde3', abbr: 'SDE-3', title: 'Software Development Engineer 3', company: 'OneCX', location: 'Gurugram, HR',
    period: 'Apr 2025 to Present', note: 'promoted from SDE-2', focus: 'Multiplayer learning platform · Bulk email service',
    color: C.blue, href: PROFILE.onecx,
    highlights: [
      'Sole backend owner of a multiplayer language-learning platform, built as a modular <b>NestJS</b> service.',
      '<b>Elasticsearch + Redis</b> search over <b>~12M</b> entries with <b>40%</b> lower latency.',
      '<b>BullMQ</b> workers took power-ups off the request path: <b>~35%</b> faster APIs.',
    ],
    more: [
      '<b>Socket.IO</b> gateway for live game state and matchmaking, with one consistent <code>${event}:error</code> contract.',
      'Zero-downtime <b>TypeORM</b> migrations on PostgreSQL: nullable → backfill → constrain.',
      '<b>Prometheus + Grafana</b> cut incident detection time by <b>50%</b>; JWT, rate limiting, field-level encryption.',
      'Bulk email service reaching <b>250K</b> recipients in under 10 minutes.',
    ],
    stack: ['nestjs', 'socketio', 'elasticsearch', 'redis', 'bullmq', 'postgres', 'typeorm', 'docker', 'prometheus', 'grafana'],
  },
  {
    id: 'sde2', abbr: 'SDE-2', title: 'Software Development Engineer 2', company: 'OneCX', location: 'Gurugram, HR',
    period: 'Nov 2022 to Mar 2025', note: '2 yr 5 mo', focus: 'INTERCOMM · BridgeQ messaging',
    color: C.purple, href: PROFILE.onecx,
    highlights: [
      'Only backend engineer on <b>INTERCOMM</b>, a WhatsApp Business API platform: <b>1M+</b> messages per quarter.',
      '<b>~100K messages/day per bot</b> at <b>99.9%</b> uptime on Redis-backed queues.',
      '<b>BridgeQ</b>: multi-channel messaging backbone on <b>Kafka</b> and <b>RabbitMQ</b>.',
    ],
    more: [
      '<b>10×</b> client reach, <b>2×</b> sales revenue and <b>+45%</b> campaign ROI in year one.',
      'Provider-credential abstraction so new channels plug in without touching core logic.',
      'Owned the <b>GitHub Actions</b> pipelines, Git workflow standards and runbooks.',
    ],
    stack: ['nodejs', 'nestjs', 'whatsapp', 'kafka', 'rabbitmq', 'redis', 'prometheus', 'grafana', 'docker', 'actions'],
  },
  {
    id: 'sde1', abbr: 'SDE-1', title: 'Software Engineer', company: 'PrepLadder (Unacademy)', location: 'Chandigarh',
    period: 'Aug 2022 to Oct 2022', note: '3 mo', focus: 'Push notifications · retention',
    color: C.green, href: 'https://www.prepladder.com',
    highlights: [
      'Push-notification scheduler with personalised payloads and send-time selection.',
      'Tuned <b>AWS RDS</b> and <b>Cassandra</b> for fast, highly available delivery.',
    ],
    more: [],
    stack: ['nodejs', 'express', 'rds', 'cassandra', 'redis'],
  },
  {
    id: 'jr', abbr: 'JR', title: 'Junior Node.js Developer', company: 'PrepLadder (Unacademy)', location: 'Chandigarh',
    period: 'May 2021 to Jul 2022', note: '1 yr 3 mo', focus: 'Course APIs · Know Your Student',
    color: C.yellow, href: 'https://www.prepladder.com',
    highlights: [
      'Course-content REST APIs serving thousands of students daily.',
      'Sole developer on <b>KYS</b>: encrypted APIs driven by database config, no deploy needed.',
      '★ <b>PrepStar of the Quarter</b>, Q2 2022.',
    ],
    more: [],
    stack: ['nodejs', 'express', 'rds', 'mysql', 'bitbucket'],
  },
];

const PROJECTS = [
  {
    id: 'engine', glyph: '>_', title: 'Real-Time Learning Engine', context: 'OneCX · sole backend owner', color: C.blue,
    body: 'Multiplayer gameplay over WebSockets with ELO matchmaking and a multi-tenant admin dashboard.',
    metrics: [['~12M', 'entries indexed'], ['200K+', 'player sessions'], ['−35%', 'API latency']],
    stack: ['nestjs', 'socketio', 'redis', 'elasticsearch', 'bullmq'],
  },
  {
    id: 'intercomm', glyph: '{}', title: 'INTERCOMM Automation', context: 'OneCX · sole backend engineer', color: C.green,
    body: 'WhatsApp campaign builder, template creator, flow designer and analytics on an event-driven core.',
    metrics: [['1M+', 'msgs / quarter'], ['99.9%', 'uptime'], ['+45%', 'campaign ROI']],
    stack: ['nestjs', 'whatsapp', 'kafka', 'rabbitmq', 'redis'],
  },
  {
    id: 'pna', glyph: '#!', title: 'PNA Push Notifications', context: 'PrepLadder · sole developer', color: C.orange,
    body: 'Personalised payloads and send-time selection that improved retention on a large EdTech platform.',
    metrics: [['Solo', 'ownership'], ['RDS', '+ Cassandra'], ['↑', 'retention']],
    stack: ['nodejs', 'express', 'rds', 'cassandra', 'redis'],
  },
  {
    id: 'kys', glyph: '</>', title: 'KYS: Know Your Student', context: 'PrepLadder · sole developer', color: C.purple,
    body: 'Encrypted APIs that drive pop-ups and forms from database config, so non-technical teams ship changes.',
    metrics: [['0', 'deploys per change'], ['Solo', 'ownership'], ['↑', 'onboarding']],
    stack: ['nodejs', 'express', 'rds', 'bitbucket'],
  },
];

const ROADMAP = [
  { icon: 'rust', name: 'Rust', status: 'Learning', why: 'Memory-safe speed for hot paths', goal: 'Workers & CLI tooling', color: C.orange },
  { icon: 'go', name: 'Go', status: 'Learning', why: 'Simple concurrency, cloud-native', goal: 'Lean cloud services', color: C.blue },
  { icon: 'spring', name: 'Spring Boot', status: 'Learning', why: 'Deeper Java for enterprise', goal: 'JVM production APIs', color: C.green },
  { icon: 'kubernetes', name: 'DevOps', status: 'Learning', why: 'Own the deploy, not just code', goal: 'K8s, IaC & GitOps', color: C.purple },
  { icon: null, name: 'SEO', status: 'Exploring', why: 'Make what I ship discoverable', goal: 'Web Vitals & schema', color: C.pink },
];

/** Drawn from the GitHub bio, LinkedIn headline and the v5 resume. */
const SUMMARY = {
  eyebrow: 'ABOUT ME',
  headline: 'Senior backend engineer building real-time, event-driven systems that hold up in production.',
  body:
    'I design and run backends in Node.js, TypeScript and NestJS: PostgreSQL schemas and zero-downtime migrations, ' +
    'Kafka and RabbitMQ pipelines, Redis caching, Elasticsearch search and Socket.IO gateways. Today I own the backend ' +
    'of a multiplayer learning platform serving 200K+ concurrent sessions. Before that I built WhatsApp automation ' +
    'moving 1M+ messages a quarter, and EdTech services at PrepLadder.',
  facts: [
    ['ROLE', 'Senior Backend Engineer, SDE-3'],
    ['COMPANY', 'OneCX'],
    ['BASED IN', 'Delhi NCR, India'],
    ['EXPERIENCE', '5+ years in production'],
    ['FOCUS', 'Real-time, events, search'],
    ['LEARNING', 'Go, Rust, Spring Boot'],
  ],
};

const LANGUAGES = [
  { code: 'EN', name: 'English', level: 'Professional working proficiency', score: 4, color: C.blue },
  { code: 'HI', name: 'Hindi', level: 'Native or bilingual proficiency', score: 5, color: C.purple },
];

/** Connect tiles. `icon` is a current simple-icons slug, `legacy` a v9 one, `null` a drawn globe. */
const CONNECT = [
  { id: 'portfolio', label: 'Portfolio', handle: 'shrikumarsharma.in', icon: null, color: C.blue, href: PROFILE.website },
  { id: 'blog', label: 'Blog', handle: 'blogs.shrikumarsharma.in', icon: 'rss', color: '#f78166', href: PROFILE.blog },
  { id: 'email', label: 'Email', handle: 'say hello', icon: 'gmail', color: '#ea4335', href: `mailto:${PROFILE.email}` },
  { id: 'linkedin', label: 'LinkedIn', handle: 'in/shreesharma07', legacy: 'linkedin', color: '#3b8fe8', href: PROFILE.linkedin },
  { id: 'github', label: 'GitHub', handle: '@shreesharma07', icon: 'github', color: '#e6edf3', href: `https://github.com/${PROFILE.github}` },
  { id: 'wakatime', label: 'WakaTime', handle: '@shreesharma07', icon: 'wakatime', color: '#e6edf3', href: `https://wakatime.com/@${PROFILE.github}` },
  { id: 'instagram', label: 'Instagram', handle: '@shree_kumar_sharma', icon: 'instagram', color: '#e4405f', href: PROFILE.instagram },
];

const FEATURED_REPO = {
  owner: 'shreesharma07',
  name: 'numsy',
  description: 'A lightweight TypeScript toolkit for validating, sanitising and processing Indian phone numbers from CSV and Excel datasets, with strong typing throughout.',
  language: { name: 'TypeScript', color: '#3178c6' },
  license: 'MIT',
  topics: ['typescript-library', 'csv-parser', 'nodejs'],
  docs: 'shreesharma07.github.io/numsy',
  href: 'https://github.com/shreesharma07/numsy',
};

/** Recognition & Certifications, drawn as one panel (award banner over three columns). */
const CREDENTIALS = {
  href: 'https://www.linkedin.com/in/shreesharma07/details/certifications/',
  award: { title: 'PrepStar of the Quarter', meta: 'Q2 2022 · PrepLadder (Unacademy)', note: 'Best-performing individual in the backend engineering team for the quarter.' },
  groups: [
    { title: 'ANTHROPIC', color: '#d97757', logo: 'anthropic', items: [['Claude with the Anthropic API'], ['Claude Code in Action'], ['Introduction to Agent Skills'], ['Introduction to MCP']] },
    { title: 'HACKERRANK', color: '#2ec866', logo: 'hackerrank', items: [['SQL', 'Advanced'], ['REST API', 'Intermediate'], ['JavaScript', 'Intermediate'], ['Problem Solving', 'Intermediate']] },
    { title: 'OTHER', color: '#2684ff', items: [['Ethereum & Solidity', 'Udemy', 'udemy', '#a435f0'], ['Jira Fundamentals', 'Atlassian', 'atlassian', '#2684ff'], ['ITSM · Jira Service Mgmt', 'Atlassian', 'jira', '#2684ff']] },
  ],
};

/**
 * Profile stats strip. Values are fetched at build time (and daily by
 * .github/workflows/profile-stats.yml); the last good values live in
 * assets/stats.json so a failed fetch never blanks a tile.
 */
const STATS_FILE = join(ASSETS, 'stats.json');

/** Animated contact buttons under the hero, in the brand colours of the old chip row. */
const CONTACT = [
  { id: 'website', label: 'Website', handle: 'shrikumarsharma.in', icon: null, color: '#1f6feb', href: PROFILE.website },
  { id: 'blog', label: 'Blog', handle: 'blogs.shrikumarsharma.in', icon: 'rss', color: '#8957e5', href: PROFILE.blog },
  { id: 'email', label: 'Email', handle: 'say hello', icon: 'gmail', color: '#da3633', href: `mailto:${PROFILE.email}` },
  { id: 'linkedin', label: 'LinkedIn', handle: 'in/shreesharma07', legacy: 'linkedin', color: '#0a66c2', href: PROFILE.linkedin },
];

const EDUCATION = [
  { id: 'bca', period: '2017 to 2020', degree: 'Bachelor of Computer Applications', school: 'Guru Gobind Singh Indraprastha University', place: 'New Delhi', color: C.yellow, href: 'https://www.ipu.ac.in' },
  { id: 'school', period: '2014 to 2016', degree: 'High School · Information Technology', school: 'Central Board of Secondary Education', place: 'Delhi', color: C.orange, href: 'https://www.cbse.gov.in' },
];

// ═════════════════════════════ FONTS ═════════════════════════════
const FONT_SOURCES = {
  SpaceGrotesk: 'https://github.com/google/fonts/raw/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf',
  JetBrainsMono: 'https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf',
};
const FACES = {
  d7: { file: 'SpaceGrotesk', wght: 700, family: 'Space Grotesk' },
  d6: { file: 'SpaceGrotesk', wght: 600, family: 'Space Grotesk' },
  d5: { file: 'SpaceGrotesk', wght: 500, family: 'Space Grotesk' },
  m4: { file: 'JetBrainsMono', wght: 400, family: 'JetBrains Mono' },
  m6: { file: 'JetBrainsMono', wght: 600, family: 'JetBrains Mono' },
};

async function cached(path, url, binary = true) {
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed: ${url} (${res.status})`);
    writeFileSync(path, binary ? new Uint8Array(await res.arrayBuffer()) : await res.text());
  }
  return readFileSync(path, binary ? undefined : 'utf8');
}

const fontBuffers = {};
const legacyLogo = {};
const skillSvg = {};
const brandSvg = {};
async function loadResources() {
  for (const dir of ['fonts', 'icons', 'skillicons']) mkdirSync(join(CACHE, dir), { recursive: true });
  for (const [name, url] of Object.entries(FONT_SOURCES)) fontBuffers[name] = await cached(join(CACHE, 'fonts', `${name}.ttf`), url);
  for (const slug of LEGACY_LOGOS) {
    const path = join(CACHE, 'icons', `${slug}.svg`);
    for (const v of ['9.21.0', '8.15.0']) {
      try {
        legacyLogo[slug] = await cached(path, `https://cdn.jsdelivr.net/npm/simple-icons@${v}/icons/${slug}.svg`, false);
        break;
      } catch {}
    }
  }
  // brand marks for connect tiles, contact buttons, the featured repo and every Tech & Skills pill
  const brands = new Set(['github', 'wakatime', ...CONNECT.map((c) => c.icon), ...CONTACT.map((c) => c.icon)]);
  for (const g of CREDENTIALS.groups) {
    brands.add(g.logo);
    for (const it of g.items) brands.add(it[2]);
  }
  for (const r of EXPERIENCE) for (const k of r.stack) brands.add(TECH[k].logo);
  for (const g of SKILL_GROUPS) for (const k of g.keys) brands.add(TECH[k].logo);
  for (const slug of [...brands].filter((b) => b && !LEGACY_LOGOS.includes(b))) {
    // newest first; a slug renamed or dropped in one release often survives in another
    for (const v of ['16.35.0', '15.22.0', '13.21.0']) {
      try {
        brandSvg[slug] = await cached(join(CACHE, 'icons', `si-${slug}.svg`), `https://cdn.jsdelivr.net/npm/simple-icons@${v}/icons/${slug}.svg`, false);
        break;
      } catch {}
    }
    if (!brandSvg[slug]) console.warn(`no simple-icons mark for "${slug}"; the pill falls back to a dot`);
  }
  const skills = new Set([...ROADMAP.map((r) => r.icon), ...PRIMARY_STACK.map((k) => TECH[k].icon)]);
  for (const id of [...skills].filter(Boolean)) {
    skillSvg[id] = await cached(join(CACHE, 'skillicons', `${id}.svg`), `https://skillicons.dev/icons?i=${id}&theme=dark`, false);
  }
}

const hbFonts = {};
function hbFont(key) {
  if (!hbFonts[key]) {
    const face = new Face(new Blob(fontBuffers[FACES[key].file]), 0);
    const font = new Font(face);
    font.setVariations([new Variation('wght', FACES[key].wght)]);
    hbFonts[key] = { face, font };
  }
  return hbFonts[key];
}

/** Rendered width in px of `str` in face `key` at `size`. */
function measure(key, str, size) {
  const { face, font } = hbFont(key);
  const buf = new HbBuffer();
  buf.addText(str);
  buf.guessSegmentProperties();
  shape(font, buf);
  return (buf.getGlyphPositions().reduce((sum, p) => sum + p.xAdvance, 0) / face.upem) * size;
}

/** Largest size <= `size` at which `str` fits in `max` px. */
function fit(key, str, size, max) {
  let s = size;
  while (s > 8 && measure(key, str, s) > max) s -= 0.5;
  return s;
}

/** Greedy word wrap to `max` px. */
function wrap(key, str, size, max) {
  const lines = [];
  let cur = '';
  for (const word of str.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && measure(key, next, size) > max) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ═════════════════════════════ SVG DOCUMENT ═════════════════════════════
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class Svg {
  constructor(w, h, title) {
    Object.assign(this, { w, h, title, used: {}, defs: [], css: [], body: [] });
  }
  use(key, str) {
    this.used[key] = (this.used[key] ?? '') + str;
  }
  text(key, str, { x, y, size, fill = C.text, anchor = 'start', cls = '', style = '' }) {
    this.use(key, str);
    this.body.push(
      `<text x="${x}" y="${y}" class="${key} ${cls}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${style ? ` style="${style}"` : ''}>${xml(str)}</text>`,
    );
  }
  /** One line of differently coloured runs. */
  runs(key, parts, { x, y, size, cls = '' }) {
    const tspans = parts
      .map(([s, fill]) => {
        this.use(key, s);
        return `<tspan fill="${fill}">${xml(s)}</tspan>`;
      })
      .join('');
    this.body.push(`<text x="${x}" y="${y}" class="${key} ${cls}" font-size="${size}" xml:space="preserve">${tspans}</text>`);
  }
  /** Wrapped paragraph; returns the y of the last baseline. */
  para(key, str, { x, y, size, max, lead = 1.45, fill = C.muted }) {
    const lines = wrap(key, str, size, max);
    lines.forEach((line, i) => this.text(key, line, { x, y: y + i * size * lead, size, fill }));
    return y + (lines.length - 1) * size * lead;
  }
  pill(label, { x, y, color, key = 'm6', size = 13, h = 26, anchor = 'start' }) {
    const w = measure(key, label, size) + 24;
    const px = anchor === 'end' ? x - w : x;
    this.raw(`<rect x="${px}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-opacity=".55"/>`);
    this.text(key, label, { x: px + w / 2, y: y + h / 2 + size * 0.36, size, fill: color, anchor: 'middle' });
    return w;
  }
  raw(s) {
    this.body.push(s);
  }
  async render() {
    const faces = [];
    for (const [key, str] of Object.entries(this.used)) {
      const f = FACES[key];
      const woff2 = await subsetFont(fontBuffers[f.file], [...new Set(`${str} `)].join(''), {
        targetFormat: 'woff2',
        variationAxes: { wght: f.wght },
      });
      faces.push(
        `@font-face{font-family:'${key}';src:url(data:font/woff2;base64,${woff2.toString('base64')}) format('woff2');}`,
        `.${key}{font-family:'${key}','${f.family}',${f.file === 'JetBrainsMono' ? 'ui-monospace,monospace' : 'system-ui,sans-serif'};font-weight:normal;}`,
      );
    }
    const css = [...faces, ...COMMON_CSS, ...this.css, '@media (prefers-reduced-motion:reduce){*{animation:none!important;}}'].join('\n');
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.w}" height="${this.h}" viewBox="0 0 ${this.w} ${this.h}" role="img" aria-label="${xml(this.title)}">`,
      `<title>${xml(this.title)}</title>`,
      `<style>\n${css}\n</style>`,
      `<defs>${this.defs.join('')}</defs>`,
      ...this.body,
      '</svg>',
    ].join('\n');
  }
}

const COMMON_CSS = [
  '@keyframes rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
  '@keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
  '@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:0}}',
  '@keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}',
  '.rise{animation:rise .7s cubic-bezier(.2,.8,.2,1) both}',
  '.grow{transform-box:fill-box;transform-origin:left center;animation:grow 1.1s cubic-bezier(.2,.8,.2,1) both}',
];

const cardRect = (x, y, w, h, { rx = 16, fill = C.bg, stroke = C.border } = {}) =>
  `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;

/** Inline a skillicons.dev SVG, namespacing its ids so several can coexist. */
function inlineIcon(svgText, prefix, x, y, size) {
  const inner = svgText
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/id="([^"]+)"/g, `id="${prefix}-$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${prefix}-$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${prefix}-$1"`);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 256 256" fill="none">${inner}</svg>`;
}

// ═════════════════════════════ SVG RENDERERS ═════════════════════════════
async function heroSvg() {
  const W = 1200, H = 380;
  const s = new Svg(W, H, `${PROFILE.name}, ${PROFILE.role}`);
  s.css.push(
    '@keyframes drift1{0%,100%{transform:translate(0,0)}50%{transform:translate(-60px,40px)}}',
    '@keyframes drift2{0%,100%{transform:translate(0,0)}50%{transform:translate(70px,-30px)}}',
    '.o1{animation:drift1 14s ease-in-out infinite}.o2{animation:drift2 18s ease-in-out infinite}',
    '.caret{animation:blink 1.1s steps(1) infinite}',
  );
  s.defs.push(
    `<clipPath id="clip"><rect width="${W}" height="${H}" rx="20"/></clipPath>`,
    `<radialGradient id="gb"><stop offset="0" stop-color="${C.blueDeep}" stop-opacity=".5"/><stop offset="1" stop-color="${C.blueDeep}" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="gp"><stop offset="0" stop-color="${C.purpleDeep}" stop-opacity=".45"/><stop offset="1" stop-color="${C.purpleDeep}" stop-opacity="0"/></radialGradient>`,
    `<pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.1" fill="${C.border}"/></pattern>`,
    `<linearGradient id="name" x1="0" x2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#a5d6ff"/><stop offset="1" stop-color="#d2a8ff"/></linearGradient>`,
  );
  s.raw('<g clip-path="url(#clip)">');
  s.raw(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`);
  s.raw(`<rect width="${W}" height="${H}" fill="url(#dots)" opacity=".4"/>`);
  s.raw('<circle class="o1" cx="1010" cy="40" r="300" fill="url(#gb)"/>');
  s.raw('<circle class="o2" cx="140" cy="390" r="300" fill="url(#gp)"/>');
  s.raw('</g>');
  s.raw(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="20" fill="none" stroke="${C.border}"/>`);

  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => s.raw(`<circle cx="${36 + i * 20}" cy="34" r="6" fill="${c}"/>`));
  s.text('m4', 'shri@backend: ~', { x: W / 2, y: 39, size: 13, fill: C.faint, anchor: 'middle' });

  const X = 64;
  s.runs('m6', [['$ ', C.green], ['whoami', C.text]], { x: X, y: 104, size: 18, cls: 'rise' });
  s.raw(`<rect class="caret" x="${X + measure('m6', '$ whoami ', 18)}" y="89" width="10" height="19" fill="${C.blue}"/>`);
  s.text('d7', PROFILE.name, { x: X - 3, y: 184, size: 64, fill: 'url(#name)', cls: 'rise', style: 'animation-delay:.15s' });
  s.runs('d5', [['Backend Engineer', C.text], ['  ·  ', C.faint], ['SDE-3', C.blue], [' @ OneCX', C.text]], { x: X, y: 232, size: 28, cls: 'rise' });
  s.text('m4', 'Node.js · TypeScript · NestJS · PostgreSQL', { x: X, y: 270, size: 16, fill: C.muted, cls: 'rise' });

  let cx = X;
  for (const [label, dot] of [['5+ yrs in production', C.green], ['Delhi, IN', C.orange], ['open to collaborate', C.purple]]) {
    const w = measure('m4', label, 14) + 46;
    s.raw(`<g class="rise" style="animation-delay:.35s"><rect x="${cx}" y="300" width="${w}" height="38" rx="19" fill="${C.surface}" stroke="${C.border}"/><circle cx="${cx + 19}" cy="319" r="4.5" fill="${dot}"/>`);
    s.text('m4', label, { x: cx + 32, y: 324, size: 14, fill: C.text });
    s.raw('</g>');
    cx += w + 12;
  }

  const cw = 420, ch = 272, kx = W - 56 - cw, ky = 66;
  s.raw(`<g class="rise" style="animation-delay:.25s">${cardRect(kx, ky, cw, ch, { rx: 14, fill: C.surface })}<path d="M${kx} ${ky + 42}h${cw}" stroke="${C.border}"/></g>`);
  s.text('m4', 'profile.ts', { x: kx + 22, y: ky + 27, size: 13, fill: C.muted });
  s.text('m6', 'TS', { x: kx + cw - 22, y: ky + 27, size: 12, fill: C.blue, anchor: 'end' });
  const P = C.text, K = C.red, I = '#d2a8ff', T = '#ffa657', R = '#79c0ff', S = '#a5d6ff';
  const code = [
    [['const ', K], ['shri', I], [': ', P], ['Engineer', T], [' = {', P]],
    [['  role', R], [': ', P], ['"SDE-3"', S], [',', P]],
    [['  experience', R], [': ', P], ['"5+ yrs"', S], [',', P]],
    [['  stack', R], [': [', P], ['"NestJS"', S], [', ', P], ['"Postgres"', S], [', ', P], ['"Kafka"', S], ['],', P]],
    [['  ships', R], [': [', P], ['"realtime"', S], [', ', P], ['"search"', S], [', ', P], ['"queues"', S], ['],', P]],
    [['  learning', R], [': [', P], ['"Rust"', S], [', ', P], ['"Go"', S], [', ', P], ['"Spring Boot"', S], ['],', P]],
    [['  next', R], [': [', P], ['"DevOps"', S], [', ', P], ['"SEO"', S], ['],', P]],
    [['};', P]],
  ];
  code.forEach((parts, i) => {
    const y = ky + 72 + i * 25;
    s.raw(`<g class="rise" style="animation-delay:${0.45 + i * 0.12}s">`);
    s.text('m4', String(i + 1), { x: kx + 32, y, size: 13, fill: C.faint, anchor: 'end' });
    s.runs('m4', parts, { x: kx + 46, y, size: 14 });
    s.raw('</g>');
  });
  return s.render();
}

/** Section header. The transparent band above the card is the section's top margin. */
async function headerSvg({ title, cmd, accent }, index) {
  const W = 1200, M = 44, CH = 84, H = M + CH;
  const s = new Svg(W, H, title);
  s.css.push('@keyframes travel{0%{transform:translateX(0);opacity:0}10%,90%{opacity:1}100%{transform:translateX(var(--d));opacity:0}}');
  s.defs.push(`<linearGradient id="u" x1="0" x2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>`);
  s.raw(cardRect(0, M, W, CH, { rx: 14, stroke: C.hair }));
  const num = String(index + 1).padStart(2, '0');
  const base = M + 50;
  s.text('m6', num, { x: 36, y: base - 1, size: 18, fill: accent });
  const tx = 36 + measure('m6', num, 18) + 18;
  s.raw(`<path d="M${tx - 10} ${M + 26}v32" stroke="${C.border}"/>`);
  s.text('d7', title, { x: tx + 8, y: base, size: 30, fill: C.text, cls: 'rise' });
  const tw = measure('d7', title, 30);
  s.raw(`<rect class="grow" x="${tx + 8}" y="${base + 12}" width="${tw}" height="2" rx="1" fill="url(#u)"/>`);
  s.raw(`<circle cx="${tx + 8}" cy="${base + 13}" r="2.5" fill="${accent}" style="--d:${tw}px;animation:travel 3.6s ease-in-out 1.2s infinite"/>`);
  s.runs('m4', [['$ ', accent], [cmd, C.faint]], { x: W - 36 - measure('m4', `$ ${cmd}`, 14), y: base - 2, size: 14 });
  return s.render();
}

async function principlesSvg() {
  const W = 1200, gap = 20, cols = 4, tw = (W - gap * (cols - 1)) / cols, th = 168;
  const s = new Svg(W, th, 'How I work');
  PRINCIPLES.forEach((p, i) => {
    const x = i * (tw + gap);
    s.raw(`<g class="rise" style="animation-delay:${i * 0.1}s">`);
    s.raw(cardRect(x, 0, tw, th));
    s.raw(`<rect x="${x + 28}" y="28" width="28" height="4" rx="2" fill="${p.color}"/>`);
    s.text('d6', p.title, { x: x + 28, y: 70, size: fit('d6', p.title, 20, tw - 56), fill: C.text });
    s.para('d5', p.body, { x: x + 28, y: 102, size: 15, max: tw - 56 });
    s.raw('</g>');
  });
  return s.render();
}

async function impactSvg() {
  const W = 1200, gap = 20, cols = 4, tw = (W - gap * (cols - 1)) / cols, th = 156;
  const H = th * 2 + gap;
  const s = new Svg(W, H, 'Impact in production');
  IMPACT.forEach((t, i) => {
    const x = (i % cols) * (tw + gap), y = Math.floor(i / cols) * (th + gap);
    s.raw(`<g class="rise" style="animation-delay:${i * 0.08}s">`);
    s.raw(cardRect(x, y, tw, th));
    s.raw(`<rect x="${x + 28}" y="${y + 28}" width="28" height="4" rx="2" fill="${t.color}"/>`);
    s.text('d7', t.value, { x: x + 28, y: y + 84, size: 42, fill: t.color });
    s.text('d5', t.label, { x: x + 28, y: y + 112, size: fit('d5', t.label, 16, tw - 56), fill: C.text });
    s.text('m4', t.sub, { x: x + 28, y: y + 134, size: fit('m4', t.sub, 12.5, tw - 56), fill: C.faint });
    s.raw('</g>');
  });
  return s.render();
}

async function timelineSvg() {
  const W = 1200, X0 = 480, X1 = 1160, Y0 = 2017, Y1 = 2027;
  const rowH = 80, top = 104, axisY = top + TIMELINE.length * rowH + 8;
  const H = axisY + 56;
  const sx = (t) => X0 + ((t - Y0) / (Y1 - Y0)) * (X1 - X0);
  const s = new Svg(W, H, 'Career timeline, 2017 to present');
  s.raw(cardRect(0, 0, W, H));

  let lx = 40;
  for (const [label, color] of [['Education', C.yellow], ['PrepLadder', C.green], ['OneCX · SDE-2', C.purple], ['OneCX · SDE-3', C.blue]]) {
    s.raw(`<rect x="${lx}" y="38" width="20" height="10" rx="5" fill="${color}"/>`);
    s.text('d5', label, { x: lx + 30, y: 48, size: 15, fill: C.text });
    lx += 30 + measure('d5', label, 15) + 32;
  }
  const summary = '5+ yrs professional  ·  4 roles  ·  2 companies';
  s.runs('m4', [['5+ yrs', C.green], [' professional  ·  ', C.faint], ['4', C.blue], [' roles  ·  ', C.faint], ['2', C.purple], [' companies', C.faint]], {
    x: W - 40 - measure('m4', summary, 14), y: 48, size: 14,
  });
  s.raw(`<path d="M40 76H${W - 40}" stroke="${C.hair}"/>`);

  for (let y = Y0; y < Y1; y++) {
    const x = sx(y);
    s.raw(`<path d="M${x} ${top - 8}V${axisY}" stroke="${C.hair}" stroke-dasharray="3 6"/>`);
    s.text('m4', String(y), { x, y: axisY + 28, size: 13, fill: C.faint, anchor: 'middle' });
  }
  s.raw(`<path d="M${X0} ${axisY}H${X1}" stroke="${C.border}"/>`);
  s.text('m6', 'NOW →', { x: X1, y: axisY + 28, size: 12, fill: C.blue, anchor: 'end' });

  TIMELINE.forEach((r, i) => {
    const y = top + i * rowH;
    const cw = s.pill(r.chip, { x: 40, y: y + 4, color: r.color, size: 12, h: 26 });
    const titleX = 40 + cw + 14;
    s.text('d6', r.title, { x: titleX, y: y + 23, size: fit('d6', r.title, 18, X0 - titleX - 32), fill: C.text });
    s.text('m4', r.sub, { x: 40, y: y + 56, size: 13, fill: C.faint });
    const bx = sx(r.from), bx2 = r.to ? sx(r.to) : X1, bw = Math.max(bx2 - bx, 6);
    const delay = `animation-delay:${0.15 + i * 0.18}s`;
    if (r.to) {
      s.raw(`<rect class="grow" x="${bx}" y="${y + 6}" width="${bw}" height="22" rx="7" fill="${r.color}" style="${delay}"/>`);
    } else {
      s.defs.push(`<linearGradient id="now" x1="0" x2="1"><stop offset="0" stop-color="${r.color}"/><stop offset=".7" stop-color="${r.color}"/><stop offset="1" stop-color="${r.color}" stop-opacity=".08"/></linearGradient>`);
      s.raw(`<rect class="grow" x="${bx}" y="${y + 6}" width="${bw}" height="22" rx="7" fill="url(#now)" style="${delay}"/>`);
      s.raw(`<circle cx="${bx + 14}" cy="${y + 17}" r="4.5" fill="${C.bg}" style="animation:pulse 1.6s ease-in-out infinite"/>`);
    }
    const cap = `${r.period}  ·  ${r.span}`;
    const capW = measure('m4', cap, 13);
    const capX = bx + capW <= X1 ? bx : Math.max(X0, bx2 - capW);
    s.runs('m4', [[r.period, C.text], ['  ·  ', C.faint], [r.span, r.color]], { x: capX, y: y + 56, size: 13, cls: 'rise' });
  });

  return s.render();
}

/**
 * Milestone stepper, animated on a loop: a progress bar runs the rail from the
 * first milestone to the last, lighting each dot and card as it arrives, holds,
 * then fades out and starts again. Inactive milestones stay readable (dimmed),
 * so a static render still shows everything.
 */
async function milestonesSvg() {
  const W = 1200, gap = 20, n = MILESTONES.length, cw = (W - gap * (n - 1)) / n, railY = 22, cardY = 56, ch = 176;
  const H = cardY + ch;
  const T = 9, travel = 0.62, hold = 0.9; // cycle seconds; fraction spent travelling; fraction at which the reset begins
  const s = new Svg(W, H, `Milestones: ${MILESTONES.map((m) => `${m.title} (${m.date})`).join(', ')}`);
  const cx = (i) => i * (cw + gap) + cw / 2;
  const railLen = cx(n - 1) - cx(0);
  const pct = (f) => `${(f * 100).toFixed(2)}%`;

  s.css.push(
    `@keyframes railrun{0%{transform:scaleX(0);opacity:1}${pct(travel)}{transform:scaleX(1);opacity:1}${pct(hold)}{transform:scaleX(1);opacity:1}100%{transform:scaleX(1);opacity:0}}`,
    `@keyframes headrun{0%{transform:translateX(0);opacity:1}${pct(travel)}{transform:translateX(${railLen}px);opacity:1}${pct(travel + 0.04)}{opacity:0}100%{transform:translateX(${railLen}px);opacity:0}}`,
    `.railrun{transform-box:fill-box;transform-origin:left center;animation:railrun ${T}s cubic-bezier(.45,0,.25,1) infinite}`,
    `.headrun{animation:headrun ${T}s cubic-bezier(.45,0,.25,1) infinite}`,
  );
  MILESTONES.forEach((_, i) => {
    const on = (travel * i) / (n - 1);
    const a = Math.max(on - 0.005, 0);
    s.css.push(
      `@keyframes ms${i}{0%,${pct(a)}{opacity:.38}${pct(on + 0.02)},${pct(hold)}{opacity:1}100%{opacity:.38}}`,
      `@keyframes mg${i}{0%,${pct(a)}{opacity:0}${pct(on + 0.02)},${pct(hold)}{opacity:1}100%{opacity:0}}`,
      `.ms${i}{animation:ms${i} ${T}s linear infinite}.mg${i}{animation:mg${i} ${T}s linear infinite}`,
    );
  });

  s.defs.push(
    `<linearGradient id="rail" x1="0" x2="1">${MILESTONES.map((m, i) => `<stop offset="${i / (n - 1)}" stop-color="${m.color}"/>`).join('')}</linearGradient>`,
    `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>`,
  );
  s.raw(`<rect x="${cx(0)}" y="${railY - 1.5}" width="${railLen}" height="3" rx="1.5" fill="${C.hair}"/>`);
  s.raw(`<rect class="railrun" x="${cx(0)}" y="${railY - 1.5}" width="${railLen}" height="3" rx="1.5" fill="url(#rail)"/>`);
  s.raw(`<g class="headrun"><circle cx="${cx(0)}" cy="${railY}" r="9" fill="${C.text}" opacity=".35" filter="url(#glow)"/><circle cx="${cx(0)}" cy="${railY}" r="3" fill="${C.text}"/></g>`);

  MILESTONES.forEach((m, i) => {
    const x = i * (cw + gap);
    s.raw(`<g class="ms${i}">`);
    s.raw(`<circle cx="${cx(i)}" cy="${railY}" r="9" fill="${C.bg}" stroke="${m.color}" stroke-width="3"/><circle cx="${cx(i)}" cy="${railY}" r="3.5" fill="${m.color}"/>`);
    s.raw(`<path d="M${cx(i)} ${railY + 10}V${cardY}" stroke="${m.color}" stroke-opacity=".5" stroke-dasharray="2 3"/>`);
    s.raw(cardRect(x, cardY, cw, ch));
    s.text('m6', m.date, { x: x + 24, y: cardY + 40, size: 13, fill: m.color });
    s.text('d7', m.title, { x: x + 24, y: cardY + 78, size: fit('d7', m.title, 20, cw - 48), fill: C.text });
    s.para('d5', m.sub, { x: x + 24, y: cardY + 110, size: 15, max: cw - 48, lead: 1.4 });
    s.raw('</g>');
    // highlight ring that lights up while the milestone is "reached"
    s.raw(`<g class="mg${i}"><rect x="${x + 1}" y="${cardY + 1}" width="${cw - 2}" height="${ch - 2}" rx="15.5" fill="none" stroke="${m.color}" stroke-opacity=".7" stroke-width="1.5"/><circle cx="${cx(i)}" cy="${railY}" r="14" fill="${m.color}" opacity=".25" filter="url(#glow)"/></g>`);
  });
  return s.render();
}

const PROJECT_W = 590, PROJECT_PAD = 28;

/** Stack pills for a project card, wrapped to the card width. */
function projectPills(p) {
  const max = PROJECT_W - PROJECT_PAD * 2, out = [];
  let x = 0, y = 0;
  for (const k of p.stack) {
    const w = 12 + 14 + 8 + measure('d5', TECH[k].label, 14) + 14;
    if (x && x + w > max) { x = 0; y += 38; }
    out.push({ k, x, y });
    x += w + 8;
  }
  return { items: out, h: y + 30 };
}

/** Height a project card needs; the README renders all four at the tallest one so rows line up. */
function projectHeight(p) {
  const P = PROJECT_PAD, bodyLines = wrap('d5', p.body, 17, PROJECT_W - P * 2).length;
  return P + 52 + 28 + bodyLines * 25.5 + 24 + 80 + 20 + projectPills(p).h + P;
}

/** Project card: header, story, three metrics and the stack, all inside one card. */
async function projectSvg(p, H) {
  const W = PROJECT_W, P = PROJECT_PAD;
  const s = new Svg(W, H, `${p.title}: ${p.body}`);
  s.raw(cardRect(0, 0, W, H));
  s.raw(`<rect x="${P}" y="${P}" width="52" height="52" rx="14" fill="${p.color}" fill-opacity=".12" stroke="${p.color}" stroke-opacity=".5"/>`);
  s.text('m6', p.glyph, { x: P + 26, y: P + 32, size: 17, fill: p.color, anchor: 'middle' });
  s.text('d7', p.title, { x: P + 68, y: P + 24, size: fit('d7', p.title, 23, W - P * 2 - 68), fill: C.text });
  s.text('m4', p.context, { x: P + 68, y: P + 46, size: 13, fill: C.faint });
  s.para('d5', p.body, { x: P, y: P + 52 + 40, size: 17, max: W - P * 2, fill: C.muted, lead: 1.5 });
  // metrics and stack are pinned to the bottom so all four cards share one baseline grid
  const pills = projectPills(p);
  const stackY = H - P - pills.h, metricsY = stackY - 20 - 80;
  const mw = (W - P * 2 - 24) / 3;
  p.metrics.forEach(([v, l], i) => {
    const mx = P + i * (mw + 12);
    s.raw(`<g class="rise" style="animation-delay:${0.1 + i * 0.1}s">${cardRect(mx, metricsY, mw, 80, { rx: 12, fill: C.surface, stroke: C.border })}`);
    s.text('d7', v, { x: mx + 18, y: metricsY + 38, size: 26, fill: p.color });
    s.text('m4', l, { x: mx + 18, y: metricsY + 62, size: fit('m4', l, 12.5, mw - 30), fill: C.faint });
    s.raw('</g>');
  });
  for (const it of pills.items) techPill(s, it.k, P + it.x, stackY + it.y, 30);
  return s.render();
}

async function roadmapSvg() {
  const W = 1200, gap = 20, cols = ROADMAP.length, tw = (W - gap * (cols - 1)) / cols, th = 262;
  const s = new Svg(W, th, 'Ambitions: Rust, Go, Spring Boot, DevOps, SEO');
  ROADMAP.forEach((r, i) => {
    const x = i * (tw + gap);
    s.raw(`<g class="rise" style="animation-delay:${i * 0.1}s">`);
    s.raw(cardRect(x, 0, tw, th));
    if (r.icon) {
      s.raw(inlineIcon(skillSvg[r.icon], `i${i}`, x + 24, 24, 52));
    } else {
      s.raw(`<rect x="${x + 24}" y="24" width="52" height="52" rx="12" fill="#242938"/>`);
      s.raw(`<circle cx="${x + 47}" cy="47" r="11" fill="none" stroke="${r.color}" stroke-width="3.5"/><path d="M${x + 55} ${55}l9 9" stroke="${r.color}" stroke-width="4" stroke-linecap="round"/>`);
    }
    s.pill(r.status, { x: x + tw - 20, y: 36, color: r.color, key: 'm4', size: 11.5, h: 24, anchor: 'end' });
    s.text('d7', r.name, { x: x + 24, y: 118, size: 24, fill: C.text });
    s.para('d5', r.why, { x: x + 24, y: 148, size: 15, max: tw - 48, fill: C.muted, lead: 1.4 });
    s.raw(`<path d="M${x + 24} ${th - 64}H${x + tw - 24}" stroke="${C.hair}"/>`);
    s.text('m4', 'GOAL', { x: x + 24, y: th - 40, size: 11, fill: r.color });
    s.text('m4', r.goal, { x: x + 24, y: th - 20, size: fit('m4', r.goal, 12.5, tw - 48), fill: C.text });
    s.raw('</g>');
  });
  return s.render();
}

async function educationSvg(e) {
  const W = 590, H = 150;
  const s = new Svg(W, H, `${e.degree}, ${e.school}`);
  s.raw(cardRect(0, 0, W, H));
  s.pill(e.period, { x: 28, y: 26, color: e.color, size: 12.5, h: 28 });
  s.text('d7', e.degree, { x: 28, y: 92, size: fit('d7', e.degree, 22, W - 56), fill: C.text });
  s.text('d5', `${e.school} · ${e.place}`, { x: 28, y: 122, size: fit('d5', `${e.school} · ${e.place}`, 15, W - 56), fill: C.muted });
  return s.render();
}

/** Summary: headline and story on the left, an "at a glance" fact sheet on the right. */
async function summarySvg() {
  const W = 1200, gap = 20, rw = 400, lw = W - rw - gap, pad = 36;
  const s = new Svg(W, 0, `${SUMMARY.headline} ${SUMMARY.body}`);

  // left: eyebrow, headline, body
  s.text('m6', SUMMARY.eyebrow, { x: pad, y: 56, size: 13, fill: C.blue });
  const hl = wrap('d7', SUMMARY.headline, 27, lw - pad * 2);
  hl.forEach((line, i) => s.text('d7', line, { x: pad, y: 104 + i * 36, size: 27, fill: C.text }));
  const bodyTop = 104 + (hl.length - 1) * 36 + 46;
  const bodyEnd = s.para('d5', SUMMARY.body, { x: pad, y: bodyTop, size: 16.5, max: lw - pad * 2, lead: 1.65 });

  // right: fact sheet, rows stretched so both cards end on the same line as the story
  const rx = lw + gap, rowsTop = 76;
  const H = Math.ceil(Math.max(bodyEnd + pad, rowsTop + SUMMARY.facts.length * 40 + pad - 8));
  const rowH = (H - rowsTop - pad + 8) / SUMMARY.facts.length;
  s.text('m6', 'AT A GLANCE', { x: rx + pad, y: 56, size: 13, fill: C.purple });
  SUMMARY.facts.forEach(([k, v], i) => {
    const y = rowsTop + i * rowH, mid = y + rowH / 2;
    if (i) s.raw(`<path d="M${rx + pad} ${y}H${W - pad}" stroke="${C.hair}"/>`);
    s.text('m4', k, { x: rx + pad, y: mid + 4, size: 12, fill: C.faint });
    s.text('d6', v, { x: W - pad, y: mid + 5.5, size: fit('d6', v, 16, rw - pad * 2 - 110), fill: C.text, anchor: 'end' });
  });

  s.h = H;
  s.body.unshift(cardRect(0, 0, lw, H), cardRect(rx, 0, rw, H));
  return s.render();
}

/** Spoken languages with a five-step proficiency meter. */
async function languagesSvg() {
  const W = 1200, gap = 20, cw = (W - gap) / 2, H = 150;
  const s = new Svg(W, H, LANGUAGES.map((l) => `${l.name}: ${l.level}`).join('. '));
  LANGUAGES.forEach((l, i) => {
    const x = i * (cw + gap);
    s.raw(`<g class="rise" style="animation-delay:${i * 0.12}s">`);
    s.raw(cardRect(x, 0, cw, H));
    s.pill(l.code, { x: x + 28, y: 26, color: l.color, size: 13, h: 28 });
    s.text('d7', l.name, { x: x + 28, y: 96, size: 28, fill: C.text });
    s.text('d5', l.level, { x: x + 28, y: 124, size: 15, fill: C.muted });
    const segW = 30, segGap = 6, mx = x + cw - 28 - (5 * segW + 4 * segGap);
    for (let k = 0; k < 5; k++) {
      s.raw(`<rect x="${mx + k * (segW + segGap)}" y="36" width="${segW}" height="8" rx="4" fill="${k < l.score ? l.color : C.hair}"/>`);
    }
    s.text('m4', `${l.score} / 5`, { x: x + cw - 28, y: 72, size: 12.5, fill: C.faint, anchor: 'end' });
    s.raw('</g>');
  });
  return s.render();
}

/** 24x24 simple-icons path, placed at (x, y) and scaled to `size`. */
function brandIcon(svgText, x, y, size, color) {
  const d = (svgText.match(/\sd="([^"]+)"/) || [])[1];
  return `<g transform="translate(${x} ${y}) scale(${size / 24})"><path d="${d}" fill="${color}"/></g>`;
}

/** One large Connect tile; the README lays seven of them out in a single landscape row. */
async function connectTileSvg(c) {
  const W = 200, H = 224, size = 60;
  const s = new Svg(W, H, `${c.label}: ${c.handle}`);
  s.raw(cardRect(0, 0, W, H, { rx: 22 }));
  s.raw(`<circle cx="${W / 2}" cy="82" r="50" fill="${c.color}" fill-opacity=".08"/>`);
  const ix = W / 2 - size / 2, iy = 82 - size / 2;
  if (c.icon) s.raw(brandIcon(brandSvg[c.icon], ix, iy, size, c.color));
  else if (c.legacy) s.raw(brandIcon(legacyLogo[c.legacy], ix, iy, size, c.color));
  else {
    const cx = W / 2, cy = 82, r = 28;
    s.raw(`<g fill="none" stroke="${c.color}" stroke-width="3.5"><circle cx="${cx}" cy="${cy}" r="${r}"/><ellipse cx="${cx}" cy="${cy}" rx="${r * 0.45}" ry="${r}"/><path d="M${cx - r} ${cy}H${cx + r}M${cx - r * 0.86} ${cy - r * 0.5}H${cx + r * 0.86}M${cx - r * 0.86} ${cy + r * 0.5}H${cx + r * 0.86}"/></g>`);
  }
  s.text('d7', c.label, { x: W / 2, y: 168, size: 21, fill: C.text, anchor: 'middle' });
  s.text('m4', c.handle, { x: W / 2, y: 194, size: fit('m4', c.handle, 12.5, W - 28), fill: C.faint, anchor: 'middle' });
  return s.render();
}

// ───────────── rich text: <b> and <code> runs, wrapped by measured width ─────────────
const RICH = {
  n: { key: 'd5', size: 16, fill: '#c9d1d9' },
  b: { key: 'd7', size: 16, fill: C.text },
  c: { key: 'm4', size: 14.5, fill: C.blue },
};

function richTokens(html) {
  const out = [], re = /<(\/?)(b|code)>/g;
  let style = 'n', last = 0, m;
  const push = (txt, st) => { for (const w of txt.split(/(\s+)/)) if (w) out.push({ w, st }); };
  while ((m = re.exec(html))) {
    push(html.slice(last, m.index), style);
    style = m[1] ? 'n' : m[2] === 'b' ? 'b' : 'c';
    last = re.lastIndex;
  }
  push(html.slice(last), style);
  return out;
}

function richWrap(html, max) {
  const lines = [[]];
  let width = 0;
  for (const t of richTokens(html)) {
    const f = RICH[t.st], w = measure(f.key, t.w, f.size), space = /^\s+$/.test(t.w);
    if (!space && width + w > max && lines.at(-1).length) {
      while (lines.at(-1).length && /^\s+$/.test(lines.at(-1).at(-1).w)) lines.at(-1).pop();
      lines.push([]);
      width = 0;
    }
    if (space && !lines.at(-1).length) continue;
    lines.at(-1).push(t);
    width += w;
  }
  return lines;
}

function richLine(s, tokens, x, y) {
  const spans = tokens.map((t) => {
    const f = RICH[t.st];
    s.use(f.key, t.w);
    return `<tspan class="${f.key}" font-size="${f.size}" fill="${f.fill}">${xml(t.w)}</tspan>`;
  });
  s.raw(`<text x="${x}" y="${y}" xml:space="preserve">${spans.join('')}</text>`);
}

/** Wrap a list of tech keys into pill rows; returns positions and total height. */
function pillLayout(keys, max, h = 30, gap = 8) {
  const items = [];
  let x = 0, y = 0;
  for (const k of keys) {
    const w = 12 + 14 + 8 + measure('d5', TECH[k].label, 14) + 14;
    if (x && x + w > max) { x = 0; y += h + gap; }
    items.push({ k, x, y });
    x += w + gap;
  }
  return { items, h: y + h };
}

/** Full experience card: role header, every highlight, and the stack, in one SVG. */
async function experienceSvg(r) {
  const W = 1200, P = 36, stackW = 340, colGap = 44, bodyTop = 158, lead = 25, bulletGap = 12;
  const leftW = W - P * 2 - stackW - colGap;
  const bullets = [...r.highlights, ...r.more].map((b) => richWrap(b, leftW - 22));
  let y = bodyTop, bulletYs = [];
  for (const lines of bullets) {
    bulletYs.push(y);
    y += lines.length * lead + bulletGap;
  }
  // last baseline sits 26px below its slot top; +6 covers descenders
  const leftEnd = y - bulletGap + 7;
  const pills = pillLayout(r.stack, stackW);
  const rightEnd = bodyTop + 14 + pills.h;
  const H = Math.ceil(Math.max(leftEnd, rightEnd) + P - 4);
  const plain = [...r.highlights, ...r.more].map((b) => b.replace(/<[^>]+>/g, '')).join(' ');
  const s = new Svg(W, H, `${r.title} at ${r.company}, ${r.period}. ${plain}`);

  // header
  s.raw(cardRect(0, 0, W, H));
  s.raw(`<rect x="0" y="28" width="4" height="64" rx="2" fill="${r.color}"/>`);
  const pw = s.pill(r.abbr, { x: P, y: 26, color: r.color, size: 13, h: 28 });
  const right = measure('m6', r.period, 16) + 40;
  s.text('d7', r.title, { x: P + pw + 16, y: 48, size: fit('d7', r.title, 26, W - P - pw - 16 - right - 60), fill: C.text });
  s.runs('d5', [[r.company, r.color], ['   ·   ', C.faint], [r.location, C.muted]], { x: P, y: 90, size: 17 });
  s.text('m6', r.period, { x: W - P, y: 46, size: 16, fill: C.text, anchor: 'end' });
  s.text('m4', r.focus, { x: W - P, y: 88, size: 13, fill: C.faint, anchor: 'end' });
  if (r.note) s.pill(r.note, { x: W - P - measure('m4', r.focus, 13) - 16, y: 70, color: r.color, key: 'm4', size: 12, h: 26, anchor: 'end' });
  s.raw(`<path d="M${P} 120H${W - P}" stroke="${C.hair}"/>`);

  // highlights
  s.text('m6', 'HIGHLIGHTS', { x: P, y: bodyTop - 4, size: 12, fill: r.color });
  bullets.forEach((lines, i) => {
    const by = bulletYs[i] + 26;
    s.raw(`<circle cx="${P + 5}" cy="${by - 5}" r="3" fill="${r.color}" class="rise" style="animation-delay:${(0.1 + i * 0.08).toFixed(2)}s"/>`);
    lines.forEach((tokens, j) => richLine(s, tokens, P + 22, by + j * lead));
  });

  // stack
  const sx = W - P - stackW;
  s.raw(`<path d="M${sx - colGap / 2} 140V${H - 28}" stroke="${C.hair}"/>`);
  s.text('m6', 'STACK', { x: sx, y: bodyTop - 4, size: 12, fill: r.color });
  for (const it of pills.items) techPill(s, it.k, sx + it.x, bodyTop + 14 + it.y, 30);
  return s.render();
}

/** Small drawn glyphs for the stats strip and award banner. */
const GLYPH = {
  star: (cx, cy, r, color) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
    }
    return `<polygon points="${pts.join(' ')}" fill="${color}"/>`;
  },
  eye: (cx, cy, r, color) =>
    `<g fill="none" stroke="${color}" stroke-width="2.4"><path d="M${cx - r} ${cy}Q${cx} ${cy - r * 0.95} ${cx + r} ${cy}Q${cx} ${cy + r * 0.95} ${cx - r} ${cy}Z"/><circle cx="${cx}" cy="${cy}" r="${r * 0.32}" fill="${color}"/></g>`,
  people: (cx, cy, r, color) =>
    `<g fill="${color}"><circle cx="${cx - r * 0.35}" cy="${cy - r * 0.35}" r="${r * 0.3}"/><path d="M${cx - r * 0.95} ${cy + r * 0.75}a${r * 0.6} ${r * 0.55} 0 0 1 ${r * 1.2} 0z"/><circle cx="${cx + r * 0.45}" cy="${cy - r * 0.2}" r="${r * 0.25}" opacity=".7"/><path d="M${cx + r * 0.05} ${cy + r * 0.75}a${r * 0.45} ${r * 0.45} 0 0 1 ${r * 0.9} 0z" opacity=".7"/></g>`,
};

/** Recognition & Certifications panel. */
async function credentialsSvg() {
  const W = 1200, P = 28, bannerH = 112, gap = 20, cols = CREDENTIALS.groups.length, cw = (W - gap * (cols - 1)) / cols, rowH = 46;
  const rows = Math.max(...CREDENTIALS.groups.map((g) => g.items.length));
  const colTop = bannerH + gap, colH = 66 + rows * rowH + 12, H = colTop + colH;
  const a = CREDENTIALS.award;
  const s = new Svg(W, H, `${a.title}, ${a.meta}. ${CREDENTIALS.groups.map((g) => `${g.title}: ${g.items.map((i) => i.slice(0, 2).join(' ')).join(', ')}`).join('. ')}`);
  s.css.push('@keyframes sweep{0%{transform:translateX(-320px)}100%{transform:translateX(1220px)}}');

  // award banner
  s.defs.push(
    `<clipPath id="ab"><rect width="${W}" height="${bannerH}" rx="16"/></clipPath>`,
    `<linearGradient id="gold" x1="0" x2="1"><stop offset="0" stop-color="#9e6a03" stop-opacity=".35"/><stop offset="1" stop-color="#9e6a03" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="gs" x1="0" x2="1"><stop offset="0" stop-color="${C.yellow}" stop-opacity="0"/><stop offset=".5" stop-color="${C.yellow}"/><stop offset="1" stop-color="${C.yellow}" stop-opacity="0"/></linearGradient>`,
  );
  s.raw(cardRect(0, 0, W, bannerH, { stroke: '#9e6a03' }));
  s.raw(`<g clip-path="url(#ab)"><rect width="${W * 0.6}" height="${bannerH}" fill="url(#gold)"/><rect y="0" width="320" height="3" fill="url(#gs)" style="animation:sweep 5s linear infinite"/></g>`);
  s.raw(`<circle cx="${P + 30}" cy="${bannerH / 2}" r="30" fill="#9e6a03" fill-opacity=".35" stroke="${C.yellow}" stroke-opacity=".6"/>`);
  s.raw(`<g style="animation:pulse 2.4s ease-in-out infinite">${GLYPH.star(P + 30, bannerH / 2, 15, C.yellow)}</g>`);
  s.text('m6', 'AWARD', { x: P + 80, y: 36, size: 12, fill: C.yellow });
  s.text('d7', a.title, { x: P + 80, y: 66, size: 24, fill: C.text });
  s.text('m4', a.meta, { x: P + 80, y: 90, size: 13, fill: C.muted });
  s.para('d5', a.note, { x: W - P - 420, y: 52, size: 15, max: 420, fill: C.muted, lead: 1.5 });

  // certification columns
  CREDENTIALS.groups.forEach((g, i) => {
    const x = i * (cw + gap), y = colTop;
    s.raw(`<g class="rise" style="animation-delay:${(0.1 + i * 0.1).toFixed(2)}s">`);
    s.raw(cardRect(x, y, cw, colH));
    if (g.logo) s.raw(brandIcon(brandSvg[g.logo], x + P, y + 24, 18, g.color));
    s.text('m6', g.title, { x: x + P + (g.logo ? 28 : 0), y: y + 38, size: 12.5, fill: g.color });
    s.text('m4', String(g.items.length).padStart(2, '0'), { x: x + cw - P, y: y + 38, size: 12.5, fill: C.faint, anchor: 'end' });
    g.items.forEach(([name, level, logo, color], j) => {
      const ry = y + 66 + j * rowH;
      if (j) s.raw(`<path d="M${x + P} ${ry}H${x + cw - P}" stroke="${C.hair}"/>`);
      const mark = logo || g.logo, mcol = color || g.color;
      s.raw(brandIcon(brandSvg[mark], x + P, ry + 15, 15, mcol));
      const tagW = level ? measure('m4', level, 11.5) + 24 : 0;
      s.text('d5', name, { x: x + P + 26, y: ry + 28, size: fit('d5', name, 15, cw - P * 2 - 26 - tagW - 10), fill: C.text });
      if (level) s.pill(level, { x: x + cw - P, y: ry + 10, color: g.title === 'HACKERRANK' ? C.green : mcol, key: 'm4', size: 11.5, h: 24, anchor: 'end' });
    });
    s.raw('</g>');
  });
  return s.render();
}

/** Fetch the four profile numbers; on any failure keep the last good value. */
async function fetchStats() {
  let prev = {};
  try { prev = JSON.parse(readFileSync(STATS_FILE, 'utf8')); } catch {}
  const gh = PROFILE.github, out = { ...prev };
  const headers = { 'user-agent': 'profile-readme-builder', ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) };
  const get = async (url, as = 'json') => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    return as === 'json' ? res.json() : res.text();
  };
  const svgTexts = (svg) => [...svg.matchAll(/<text[^>]*>([^<]+)<\/text>/g)].map((m) => m[1].trim());
  try { out.followers = (await get(`https://api.github.com/users/${gh}`)).followers; } catch (e) { console.warn('followers:', e.message); }
  try {
    let stars = 0;
    for (let page = 1; page < 10; page++) {
      const repos = await get(`https://api.github.com/users/${gh}/repos?per_page=100&type=owner&page=${page}`);
      stars += repos.filter((r) => !r.fork).reduce((sum, r) => sum + r.stargazers_count, 0);
      if (repos.length < 100) break;
    }
    out.stars = stars;
  } catch (e) { console.warn('stars:', e.message); }
  try {
    const t = svgTexts(await get(`https://wakatime.com/badge/user/${PROFILE.wakatimeId}.svg`, 'text')).find((x) => /\bhrs?\b/.test(x));
    if (t) out.coding = t.replace(/\s+\d+\s+mins?$/, '');
  } catch (e) { console.warn('wakatime:', e.message); }
  try {
    // note: komarev counts every request as a view, so each refresh adds one
    const t = svgTexts(await get(`https://komarev.com/ghpvc/?username=${gh}&abbreviated=true`, 'text')).find((x) => /^[\d.,]+[KMB]?$/.test(x));
    if (t) out.views = t;
  } catch (e) { console.warn('views:', e.message); }
  out.updated = new Date().toISOString().slice(0, 10);
  mkdirSync(ASSETS, { recursive: true });
  writeFileSync(STATS_FILE, `${JSON.stringify(out, null, 2)}\n`);
  return out;
}

/** Four-tile stats strip: profile views, coding time, followers, stars. */
async function statsSvg(st) {
  const W = 1200, gap = 20, n = 4, tw = (W - gap * (n - 1)) / n, H = 108;
  const tiles = [
    { label: 'PROFILE VIEWS', value: st.views ?? '·', color: C.blue, icon: (cx, cy) => GLYPH.eye(cx, cy, 13, C.blue) },
    { label: 'CODING TIME · ALL TIME', value: st.coding ?? '·', color: C.purple, icon: (cx, cy) => brandIcon(brandSvg.wakatime, cx - 11, cy - 11, 22, C.purple) },
    { label: 'FOLLOWERS', value: st.followers ?? '·', color: C.green, icon: (cx, cy) => GLYPH.people(cx, cy, 13, C.green) },
    { label: 'STARS EARNED', value: st.stars ?? '·', color: C.yellow, icon: (cx, cy) => GLYPH.star(cx, cy, 12, C.yellow) },
  ];
  const s = new Svg(W, H, `${tiles.map((t) => `${t.label.toLowerCase()}: ${t.value}`).join(', ')} (updated ${st.updated})`);
  tiles.forEach((t, i) => {
    const x = i * (tw + gap), icx = x + 24 + 24, icy = H / 2;
    s.raw(`<g class="rise" style="animation-delay:${(i * 0.08).toFixed(2)}s">`);
    s.raw(cardRect(x, 0, tw, H));
    s.raw(`<rect x="${x + 24}" y="${icy - 24}" width="48" height="48" rx="13" fill="${t.color}" fill-opacity=".12" stroke="${t.color}" stroke-opacity=".45"/>`);
    s.raw(t.icon(icx, icy));
    const vx = x + 24 + 48 + 18;
    s.text('d7', String(t.value), { x: vx, y: icy + 4, size: fit('d7', String(t.value), 28, tw - (vx - x) - 20), fill: C.text });
    s.text('m4', t.label, { x: vx, y: icy + 28, size: fit('m4', t.label, 11.5, tw - (vx - x) - 20), fill: C.faint });
    s.raw(`<circle cx="${x + tw - 18}" cy="18" r="3.5" fill="${t.color}" style="animation:pulse 2s ease-in-out ${(i * 0.4).toFixed(1)}s infinite"/>`);
    s.raw('</g>');
  });
  return s.render();
}

/** "Back to top" button with a bobbing arrow. */
async function backToTopSvg() {
  const W = 220, H = 52;
  const s = new Svg(W, H, 'Back to top');
  s.css.push('@keyframes up{0%,100%{transform:translateY(2px)}50%{transform:translateY(-3px)}}', '.up{animation:up 1.6s ease-in-out infinite}');
  s.raw(`<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${(H - 1) / 2}" fill="${C.surface}" stroke="${C.blue}" stroke-opacity=".55"/>`);
  s.raw(`<circle cx="30" cy="${H / 2}" r="14" fill="${C.blue}" fill-opacity=".15"/>`);
  s.raw(`<g class="up"><path d="M30 ${H / 2 + 7}V${H / 2 - 6}M24 ${H / 2}l6-6 6 6" fill="none" stroke="${C.blue}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>`);
  s.text('d6', 'Back to top', { x: 56, y: H / 2 + 6, size: 17, fill: C.text });
  s.text('m4', '#top', { x: W - 22, y: H / 2 + 5, size: 12.5, fill: C.faint, anchor: 'end' });
  return s.render();
}

/** Non-numbered banner between page blocks: a labelled pill on a flowing rule. */
async function separatorSvg(sep) {
  const W = 1200, H = 120, cy = 54;
  const s = new Svg(W, H, `${sep.eyebrow}: ${sep.caption}`);
  s.css.push('@keyframes flow{to{stroke-dashoffset:-48}}', '.flow{animation:flow 2.4s linear infinite}');
  const pw = measure('m6', sep.eyebrow, 14) + 56, px = (W - pw) / 2;
  s.defs.push(
    `<linearGradient id="fl" x1="0" x2="1"><stop offset="0" stop-color="${sep.accent}" stop-opacity="0"/><stop offset="1" stop-color="${sep.accent}"/></linearGradient>`,
    `<linearGradient id="fr" x1="0" x2="1"><stop offset="0" stop-color="${sep.accent}"/><stop offset="1" stop-color="${sep.accent}" stop-opacity="0"/></linearGradient>`,
  );
  s.raw(`<path class="flow" d="M0 ${cy}H${px - 20}" stroke="url(#fl)" stroke-width="2" stroke-dasharray="14 10"/>`);
  s.raw(`<path class="flow" d="M${W} ${cy}H${px + pw + 20}" stroke="url(#fr)" stroke-width="2" stroke-dasharray="14 10"/>`);
  s.raw(`<rect x="${px}" y="${cy - 21}" width="${pw}" height="42" rx="21" fill="${C.surface}" stroke="${sep.accent}" stroke-opacity=".6"/>`);
  s.raw(`<circle cx="${px + 22}" cy="${cy}" r="4" fill="${sep.accent}" style="animation:pulse 1.8s ease-in-out infinite"/>`);
  s.text('m6', sep.eyebrow, { x: px + 36, y: cy + 5, size: 14, fill: C.text });
  s.text('m4', sep.caption, { x: W / 2, y: cy + 50, size: 13, fill: C.faint, anchor: 'middle' });
  return s.render();
}

/** Featured repository card. */
async function featuredSvg() {
  const r = FEATURED_REPO, W = 1200, pad = 32, X = pad + 64 + 24, right = 300;
  const s = new Svg(W, 0, `${r.owner}/${r.name}: ${r.description}`);
  s.css.push('@keyframes sweep{0%{transform:translateX(-320px)}100%{transform:translateX(1220px)}}');
  s.text('m6', 'FEATURED REPO', { x: X, y: 48, size: 12.5, fill: C.blue });
  s.runs('d6', [[`${r.owner} / `, C.muted]], { x: X, y: 86, size: 24 });
  s.text('d7', r.name, { x: X + measure('d6', `${r.owner} / `, 24), y: 86, size: 26, fill: C.text });
  const descEnd = s.para('d5', r.description, { x: X, y: 120, size: 16, max: W - X - right - pad, lead: 1.55 });
  // meta row: language, licence, topics
  const my = descEnd + 26;
  let mx = X;
  s.raw(`<circle cx="${mx + 6}" cy="${my + 13}" r="6" fill="${r.language.color}"/>`);
  s.text('m4', r.language.name, { x: mx + 18, y: my + 18, size: 13, fill: C.text });
  mx += 18 + measure('m4', r.language.name, 13) + 18;
  mx += s.pill(r.license, { x: mx, y: my, color: C.green, key: 'm4', size: 12, h: 26 }) + 10;
  for (const t of r.topics) mx += s.pill(`#${t}`, { x: mx, y: my, color: C.purple, key: 'm4', size: 12, h: 26 }) + 10;
  const H = Math.ceil(my + 26 + pad);
  s.h = H;
  s.defs.push(
    `<clipPath id="fc"><rect width="${W}" height="${H}" rx="16"/></clipPath>`,
    `<linearGradient id="sw" x1="0" x2="1"><stop offset="0" stop-color="${C.blue}" stop-opacity="0"/><stop offset=".5" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.purple}" stop-opacity="0"/></linearGradient>`,
  );
  s.body.unshift(
    cardRect(0, 0, W, H),
    `<g clip-path="url(#fc)"><rect y="0" width="320" height="3" fill="url(#sw)" style="animation:sweep 5s linear infinite"/></g>`,
    `<rect x="${pad}" y="${pad}" width="64" height="64" rx="16" fill="${C.surface}" stroke="${C.border}"/>`,
    brandIcon(brandSvg.github, pad + 16, pad + 16, 32, C.text),
  );
  // docs link column
  const dx = W - pad - right + 40;
  s.raw(`<path d="M${dx - 20} ${pad}V${H - pad}" stroke="${C.hair}"/>`);
  s.text('m6', 'DOCUMENTATION', { x: dx, y: 48, size: 12.5, fill: C.purple });
  s.text('d6', r.docs, { x: dx, y: 84, size: fit('d6', r.docs, 16, right - 60), fill: C.text });
  s.text('m4', 'view on GitHub →', { x: dx, y: 114, size: 13, fill: C.blue });
  return s.render();
}

/** Daily drivers: a 10 x 2 grid of skill icons, each bobbing gently in a staggered wave. */
async function primaryStackSvg() {
  const W = 1200, pad = 28, cols = 10, rows = Math.ceil(PRIMARY_STACK.length / cols), cellW = (W - pad * 2) / cols, rowH = 116, icon = 56;
  const H = pad * 2 + rows * rowH - 16;
  const s = new Svg(W, H, `Daily drivers: ${PRIMARY_STACK.map((k) => TECH[k].label).join(', ')}`);
  s.css.push(
    '@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}',
    '.bob{animation:bob 3.2s ease-in-out infinite}',
  );
  s.raw(cardRect(0, 0, W, H));
  PRIMARY_STACK.forEach((k, i) => {
    const t = TECH[k], c = i % cols, r = Math.floor(i / cols);
    const cx = pad + c * cellW + cellW / 2, y = pad + r * rowH;
    s.raw(`<g class="bob" style="animation-delay:${(i * 0.16).toFixed(2)}s">${inlineIcon(skillSvg[t.icon], `p${i}`, cx - icon / 2, y + 4, icon)}</g>`);
    s.text('d5', t.label, { x: cx, y: y + icon + 30, size: fit('d5', t.label, 13.5, cellW - 12), fill: C.muted, anchor: 'middle' });
  });
  return s.render();
}

/** One Tech & Skills pill: brand mark plus label. Returns its width. */
function techPill(s, key, x, y, h = 32) {
  const t = TECH[key], label = t.label, size = 14;
  const w = 12 + size + 8 + measure('d5', label, 14) + 14;
  s.raw(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${C.surface}" stroke="${C.border}"/>`);
  const color = `#${t.color}`;
  const mark = t.logo && (legacyLogo[t.logo] || brandSvg[t.logo]);
  s.raw(mark ? brandIcon(mark, x + 12, y + (h - size) / 2, size, color) : `<circle cx="${x + 12 + size / 2}" cy="${y + h / 2}" r="4" fill="${color}"/>`);
  s.text('d5', label, { x: x + 12 + size + 8, y: y + h / 2 + 5, size: 14, fill: C.text });
  return w;
}

/** Tech & Skills: a 3 x 3 grid of group cards, each listing its tools as pills. */
async function skillsSvg() {
  const W = 1200, gap = 20, cols = 3, cw = (W - gap * (cols - 1)) / cols, pad = 24, pillH = 32, pillGap = 8, top = 64;
  // lay out each group's pills first so row heights can be equalised
  const layouts = SKILL_GROUPS.map((g) => {
    const items = [];
    let x = 0, y = 0;
    for (const k of g.keys) {
      const w = 12 + 14 + 8 + measure('d5', TECH[k].label, 14) + 14;
      if (x && x + w > cw - pad * 2) { x = 0; y += pillH + pillGap; }
      items.push({ k, x, y });
      x += w + pillGap;
    }
    return { g, items, h: top + y + pillH + pad };
  });
  const rowHeights = [];
  for (let r = 0; r < Math.ceil(layouts.length / cols); r++) rowHeights.push(Math.max(...layouts.slice(r * cols, r * cols + cols).map((l) => l.h)));
  const H = rowHeights.reduce((a, b) => a + b, 0) + gap * (rowHeights.length - 1);
  const s = new Svg(W, H, SKILL_GROUPS.map((g) => `${g.title}: ${g.keys.map((k) => TECH[k].label).join(', ')}`).join('. '));
  layouts.forEach(({ g, items }, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = c * (cw + gap), y = rowHeights.slice(0, r).reduce((a, b) => a + b, 0) + r * gap, h = rowHeights[r];
    s.raw(`<g class="rise" style="animation-delay:${(i * 0.07).toFixed(2)}s">`);
    s.raw(cardRect(x, y, cw, h));
    s.raw(`<rect x="${x + pad}" y="${y + 26}" width="24" height="4" rx="2" fill="${g.color}"/>`);
    s.text('m6', g.title.toUpperCase(), { x: x + pad + 34, y: y + 32, size: 12.5, fill: C.text });
    s.text('m4', String(g.keys.length).padStart(2, '0'), { x: x + cw - pad, y: y + 32, size: 12.5, fill: C.faint, anchor: 'end' });
    for (const it of items) techPill(s, it.k, x + pad + it.x, y + top + it.y, pillH);
    s.raw('</g>');
  });
  return s.render();
}

/** Animated contact button: brand fill, icon with a pulsing ring, and a light sweep. */
async function contactButtonSvg(c, i) {
  const W = 300, H = 72, rx = 14;
  const s = new Svg(W, H, `${c.label}: ${c.handle}`);
  s.css.push(
    '@keyframes shine{0%{transform:translateX(-140px)}55%,100%{transform:translateX(440px)}}',
    '@keyframes ring{0%{transform:scale(1);opacity:.55}100%{transform:scale(1.55);opacity:0}}',
    `.shine{animation:shine 3.6s ease-in-out ${(i * 0.45).toFixed(2)}s infinite}`,
    `.ring{transform-box:fill-box;transform-origin:center;animation:ring 2.2s ease-out ${(i * 0.3).toFixed(2)}s infinite}`,
  );
  s.defs.push(
    `<clipPath id="bc"><rect width="${W}" height="${H}" rx="${rx}"/></clipPath>`,
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#000000" stop-opacity=".18"/></linearGradient>`,
    `<linearGradient id="sh" x1="0" x2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`,
  );
  s.raw(`<g clip-path="url(#bc)"><rect width="${W}" height="${H}" fill="${c.color}"/><rect width="${W}" height="${H}" fill="url(#bg)"/><rect class="shine" x="0" y="-20" width="90" height="${H + 40}" fill="url(#sh)" transform="skewX(-18)"/></g>`);
  const icx = 40, icy = H / 2;
  s.raw(`<circle class="ring" cx="${icx}" cy="${icy}" r="21" fill="none" stroke="#ffffff" stroke-width="2"/>`);
  s.raw(`<circle cx="${icx}" cy="${icy}" r="21" fill="#ffffff" fill-opacity=".16"/>`);
  if (c.icon) s.raw(brandIcon(brandSvg[c.icon], icx - 11, icy - 11, 22, '#ffffff'));
  else if (c.legacy) s.raw(brandIcon(legacyLogo[c.legacy], icx - 11, icy - 11, 22, '#ffffff'));
  else s.raw(`<g fill="none" stroke="#ffffff" stroke-width="2"><circle cx="${icx}" cy="${icy}" r="10"/><ellipse cx="${icx}" cy="${icy}" rx="4.5" ry="10"/><path d="M${icx - 10} ${icy}H${icx + 10}"/></g>`);
  s.text('d7', c.label, { x: 76, y: 33, size: 18, fill: '#ffffff' });
  s.text('m4', c.handle, { x: 76, y: 53, size: fit('m4', c.handle, 12.5, W - 76 - 18), fill: '#ffffff', style: 'opacity:.82' });
  return s.render();
}

async function footerSvg() {
  const W = 1200, M = 40, CH = 112, H = M + CH;
  const s = new Svg(W, H, 'Thanks for visiting');
  s.css.push('@keyframes sweep{0%{transform:translateX(-300px)}100%{transform:translateX(1200px)}}');
  s.defs.push(
    `<clipPath id="fc"><rect y="${M}" width="${W}" height="${CH}" rx="16"/></clipPath>`,
    `<linearGradient id="fl" x1="0" x2="1"><stop offset="0" stop-color="${C.purple}" stop-opacity="0"/><stop offset=".5" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.purple}" stop-opacity="0"/></linearGradient>`,
  );
  s.raw(cardRect(0, M, W, CH));
  s.raw(`<g clip-path="url(#fc)"><rect y="${H - 3}" width="300" height="3" fill="url(#fl)" style="animation:sweep 4s linear infinite"/></g>`);
  const line = "// thanks for stopping by. let's build something reliable";
  s.runs('m4', [['// ', C.faint], ['thanks for stopping by. ', C.muted], ["let's build something reliable", C.text]], {
    x: W / 2 - measure('m4', line, 16) / 2, y: M + 50, size: 16,
  });
  s.text('d6', 'shrikumarsharma.in', { x: W / 2, y: M + 82, size: 15, fill: C.blue, anchor: 'middle' });
  return s.render();
}

// ═════════════════════════════ README HELPERS ═════════════════════════════
/** shields.io static-badge path segments escape '-' and '_' by doubling. */
const seg = (s) => encodeURIComponent(String(s).replace(/-/g, '--').replace(/_/g, '__'));

function logoParams(logo, color) {
  if (!logo) return '';
  if (legacyLogo[logo]) {
    const svg = legacyLogo[logo].replace('<svg ', `<svg fill="#${color}" `);
    return `&logo=${encodeURIComponent(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)}`;
  }
  return `&logo=${logo}&logoColor=${color}`;
}

function badge({ label, message, color = '161b22', labelColor, logo, logoColor = 'FFFFFF', style = 'for-the-badge' }) {
  const path = message === undefined ? `${seg(label)}-${color}` : `${seg(label)}-${seg(message)}-${color}`;
  return `https://img.shields.io/badge/${path}?style=${style}${labelColor ? `&labelColor=${labelColor}` : ''}${logoParams(logo, logoColor)}`;
}

const img = (src, alt, attrs = '') => `<img src="${src}" alt="${xml(alt)}"${attrs ? ` ${attrs}` : ''}>`;
const link = (href, inner) => `<a href="${href}">${inner}</a>`;

/** A linked tech chip from the TECH table. */
function tech(key, { style = 'for-the-badge', height } = {}) {
  const t = TECH[key];
  if (!t) throw new Error(`unknown tech: ${key}`);
  return link(t.href, img(badge({ label: t.label, logo: t.logo, logoColor: t.color, style }), t.label, height ? `height="${height}"` : ''));
}
const techRow = (keys, opts, sep = '\n') => keys.map((k) => tech(k, opts)).join(sep);

const brandChip = (label, logo, logoColor, href, height = 32) =>
  link(href, img(badge({ label, color: '161b22', logo, logoColor }), label, `height="${height}"`));

const sectionHeader = (sec) => {
  const i = SECTIONS.indexOf(sec);
  return `<a id="${sec.id}"></a>\n<p align="center">${img(`assets/headers/${String(i + 1).padStart(2, '0')}-${sec.id}.svg`, sec.title, 'width="100%"')}</p>`;
};
const H = Object.fromEntries(SECTIONS.map((s) => [s.id, sectionHeader(s)]));

// ═════════════════════════════ README ═════════════════════════════
function readme() {
  const gh = PROFILE.github;
  const statsTheme = 'theme=github_dark&bg_color=0d1117&border_color=30363d&title_color=58a6ff&icon_color=a371f7&text_color=c9d1d9&border_radius=16';
  const typing =
    'https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=19&duration=3200&pause=1000&color=58A6FF&center=true&vCenter=true&width=1200&height=56&lines=' +
    [
      'Backend Engineer (SDE-3) @ OneCX',
      'Real-time · event-driven · search',
      'NestJS · PostgreSQL · Kafka · Redis',
      'Next up → Rust · Go · Spring Boot · DevOps · SEO',
    ]
      .map((l) => encodeURIComponent(l).replace(/%20/g, '+'))
      .join(';');

  // Inline images with no whitespace between the tags, so percentage widths add up to exactly 100%.
  const row = (items, width, gapWidth) => items.join(img('assets/gap.svg', '', `width="${gapWidth}"`));
  const sep = (id) => {
    const s = SEPARATORS.find((x) => x.id === id);
    return `<p align="center">${img(`assets/separators/${s.id}.svg`, `${s.eyebrow}: ${s.caption}`, 'width="100%"')}</p>`;
  };

  const projectCard = (p) => img(`assets/projects/${p.id}.svg`, `${p.title}: ${p.body} Stack: ${p.stack.map((k) => TECH[k].label).join(', ')}`, 'width="49%"');

  return `<!--
  Generated by tools/build-profile.mjs. Edit the data there, then run:
    cd tools && npm install && npm run build
-->
<a id="top"></a>

<p align="center">
  ${link(PROFILE.website, img('assets/hero.svg', `${PROFILE.name}, ${PROFILE.role}`, 'width="100%"'))}
</p>

<p align="center">
  ${link(PROFILE.website, img(typing, 'Backend Engineer (SDE-3) at OneCX', 'width="100%"'))}
</p>

<!-- Four buttons at 24.25% with three 1% gaps fill one row. -->
<p align="center">${row(CONTACT.map((c) => link(c.href, img(`assets/contact/${c.id}.svg`, `${c.label}: ${c.handle}`, 'width="24.25%"'))), '24.25%', '1%')}</p>

<!-- Uptime badge, hidden for now:
<p align="center">${link(PROFILE.uptimePage, img(PROFILE.uptimeBadge, 'Portfolio uptime'))}</p>
-->

<!-- Stats strip: values refreshed daily by .github/workflows/profile-stats.yml (last good values in assets/stats.json). -->
<p align="center">${link(`https://github.com/${gh}`, img('assets/stats.svg', `Profile stats: ${STATS.views} profile views, ${STATS.coding} coding time, ${STATS.followers} followers, ${STATS.stars} stars`, 'width="100%"'))}</p>

${H.summary}

<p align="center">${img('assets/summary.svg', `${SUMMARY.headline} ${SUMMARY.body}`, 'width="100%"')}</p>

<p align="center">${link(FEATURED_REPO.href, img('assets/featured.svg', `Featured repo ${FEATURED_REPO.owner}/${FEATURED_REPO.name}: ${FEATURED_REPO.description}`, 'width="100%"'))}</p>

<p align="center">${img('assets/principles.svg', 'How I work: own the full backend, design with the client, prove it with a POC, write it down', 'width="100%"')}</p>

${H.primary}

<p align="center">${img('assets/primary-stack.svg', `Daily drivers: ${PRIMARY_STACK.map((k) => TECH[k].label).join(', ')}`, 'width="100%"')}</p>

${H.coding}

<!--
  Both cards render at exactly 490x165 (stats: hide=contribs + line_height=24; top-langs compact caps at 165),
  so 49% + 2% spacer + 49%, with no whitespace between the tags, spans the streak card's full width.
-->
<p align="center">
  ${link(`https://github.com/${gh}`, img(`https://streak-stats.demolab.com?user=${gh}&theme=github-dark-blue&background=0D1117&border=30363D&ring=1F6FEB&fire=F78166&currStreakLabel=58A6FF&border_radius=16&card_width=1000&card_height=200`, 'GitHub streak', 'width="100%"'))}
</p>

<p align="center">${link(`https://github.com/${gh}`, img(`https://github-readme-stats.vercel.app/api?username=${gh}&show_icons=true&count_private=true&rank_icon=github&hide=contribs&line_height=24&card_width=490&${statsTheme}`, 'GitHub stats', 'width="49%"'))}${img('assets/spacer.svg', '', 'width="2%"')}${link(`https://github.com/${gh}?tab=repositories`, img(`https://github-readme-stats.vercel.app/api/top-langs/?username=${gh}&layout=compact&langs_count=8&card_width=490&${statsTheme}`, 'Top languages', 'width="49%"'))}</p>

<!-- Animated contribution snake: .github/workflows/snake.yml refreshes ./profile-snake every 12 hours. -->
<p align="center">
  ${link(`https://github.com/${gh}`, img('profile-snake/snake-dark.svg', 'Animated contribution snake', 'width="100%"'))}
</p>

<!-- 3D contribution city: .github/workflows/profile-3d.yml commits it to ./profile-3d-contrib. -->
<p align="center">
  ${link(`https://github.com/${gh}`, img('profile-3d-contrib/profile-city.svg', '3D contribution city', 'width="100%"'))}
</p>

<p align="center">
  ${brandChip('LeetCode', 'leetcode', 'FFA116', 'https://leetcode.com/shreesharma07/', 28)}&nbsp;
  ${brandChip('HackerRank', 'hackerrank', '2EC866', 'https://www.hackerrank.com/shreesharma07', 28)}&nbsp;
  ${brandChip('Hack The Box', 'hackthebox', '9FEF00', 'https://app.hackthebox.com/profile/1386595', 28)}&nbsp;
  ${brandChip('MonkeyType', 'monkeytype', 'E2B714', 'https://monkeytype.com/profile/shreesharma07', 28)}&nbsp;
  ${brandChip('GitLab', 'gitlab', 'FC6D26', 'https://gitlab.com/shreesharma07', 28)}&nbsp;
  ${brandChip('Google Dev', 'google', '4285F4', 'https://g.dev/shreesharma07', 28)}
</p>

${H.wakatime}

<!-- Plain image rows instead of a table: table cells add 13px padding and would inset every chart. -->
<p align="center">${link(`https://wakatime.com/@${gh}`, img(`https://github-readme-stats.vercel.app/api/wakatime?username=${gh}&layout=compact&langs_count=8&card_width=1000&custom_title=All-time+languages&${statsTheme}`, 'WakaTime all-time languages', 'width="100%"'))}</p>

<p align="center">${row([link(`https://wakatime.com/@${gh}`, img(PROFILE.wakatimeShares.pie, 'WakaTime languages pie chart', 'width="49%"')), link(`https://wakatime.com/@${gh}`, img(PROFILE.wakatimeShares.bar, 'WakaTime languages bar chart', 'width="49%"'))], '49%', '2%')}</p>

<p align="center"><sub><b>ALL TIME CODING ACTIVITY</b></sub></p>

<p align="center">${link(`https://wakatime.com/@${gh}`, img(PROFILE.wakatimeShares.activity, 'WakaTime coding activity', 'width="100%"'))}</p>
<!-- More chart types (editors, OS, categories): https://wakatime.com/share/embed, then add each share URL as a new <td>. -->

${H.connect}

<p align="center">Open to collaboration and work inquiries. Pick whichever channel suits you.</p>

<!-- Seven tiles at 13.4% with six 1.03% gaps fill one row. -->
<p align="center">${row(CONNECT.map((c) => link(c.href, img(`assets/connect/${c.id}.svg`, `${c.label}: ${c.handle}`, 'width="13.4%"'))), '13.4%', '1.03%')}</p>

${sep('more')}

${H.experience}

${EXPERIENCE.map((r) => `<p align="center">${link(r.href, img(`assets/experience/${r.id}.svg`, `${r.title} at ${r.company}, ${r.period}: ${[...r.highlights, ...r.more].map((b) => b.replace(/<[^>]+>/g, '')).join(' ')}`, 'width="100%"'))}</p>`).join('\n\n')}

${H.projects}

<p align="center">${row(PROJECTS.slice(0, 2).map(projectCard), '49%', '2%')}</p>

<p align="center">${row(PROJECTS.slice(2, 4).map(projectCard), '49%', '2%')}</p>

${H.skills}

<p align="center">${img('assets/skills.svg', SKILL_GROUPS.map((g) => `${g.title}: ${g.keys.map((k) => TECH[k].label).join(', ')}`).join('. '), 'width="100%"')}</p>

${H.ambitions}

<p align="center">${img('assets/roadmap.svg', 'Roadmap: Rust, Go, Spring Boot, DevOps and SEO', 'width="100%"')}</p>

<!-- Learning-resource chips, hidden for now:
<p align="center">
  ${link('https://doc.rust-lang.org/book/', img(badge({ label: 'The Rust Book', logo: 'rust', style: 'flat-square' }), 'The Rust Book'))}&nbsp;
  ${link('https://go.dev/tour/', img(badge({ label: 'A Tour of Go', logo: 'go', logoColor: '00ADD8', style: 'flat-square' }), 'A Tour of Go'))}&nbsp;
  ${link('https://spring.io/guides', img(badge({ label: 'Spring Guides', logo: 'springboot', logoColor: '6DB33F', style: 'flat-square' }), 'Spring Guides'))}&nbsp;
  ${techRow(['kubernetes', 'terraform', 'helm'], { style: 'flat-square' }, '&nbsp;\n  ')}
</p>
<p align="center">
  ${techRow(['argocd', 'cwv', 'lighthouse', 'searchconsole'], { style: 'flat-square' }, '&nbsp;\n  ')}
</p>
-->

${H.impact}

<p align="center">${img('assets/impact.svg', 'Impact: ~12M entries indexed, 40% lower search latency, 35% faster APIs, 50% faster incident detection, 99.9% uptime, 1M+ messages per quarter, 10x reach, 250K emails in under 10 minutes', 'width="100%"')}</p>

${H.timeline}

<p align="center">${img('assets/timeline.svg', 'Career timeline from 2017 to present', 'width="100%"')}</p>

${H.milestones}

<p align="center">${img('assets/milestones.svg', MILESTONES.map((m) => `${m.date}: ${m.title}, ${m.sub}`).join('; '), 'width="100%"')}</p>

${H.credentials}

<p align="center">${link(CREDENTIALS.href, img('assets/credentials.svg', `${CREDENTIALS.award.title}, ${CREDENTIALS.award.meta}. ${CREDENTIALS.groups.map((g) => `${g.title}: ${g.items.map((i) => i.slice(0, 2).join(' ')).join(', ')}`).join('. ')}`, 'width="100%"'))}</p>

<!-- Holopin board, hidden for now:
<p align="center">
  ${link(`https://holopin.io/@${gh}`, img(`https://holopin.me/${gh}`, 'Holopin badges', 'width="60%"'))}
</p>
-->

${H.education}

<p align="center">${row(EDUCATION.map((e) => link(e.href, img(`assets/education/${e.id}.svg`, `${e.degree}, ${e.school}`, 'width="49%"'))), '49%', '2%')}</p>

${H.languages}

<p align="center">${img('assets/languages.svg', LANGUAGES.map((l) => `${l.name}: ${l.level}`).join('. '), 'width="100%"')}</p>

${sep('last')}

${H.support}

<p align="center">If my work has helped you, sponsoring me or buying me a coffee keeps it going. Thank you!</p>

<p align="center">
  ${link(`https://github.com/sponsors/${gh}`, img('Images/Background/thank-you-no-bg.png', 'Thank you', 'height="150"'))}
</p>

<p align="center">
  ${brandChip('GitHub Sponsors', 'githubsponsors', 'EA4AAA', `https://github.com/sponsors/${gh}`)}&nbsp;
  ${brandChip('Buy Me a Coffee', 'buymeacoffee', 'FFDD00', `https://buymeacoffee.com/${gh}`)}&nbsp;
  ${brandChip('Stripe', 'stripe', '635BFF', 'https://buy.stripe.com/8wMeVU5GUg7G5Jm3cc')}&nbsp;
  ${brandChip('PayPal', 'paypal', '009CDE', 'https://www.paypal.com/paypalme/ShreeKumarSharma')}&nbsp;
  ${brandChip('Patreon', 'patreon', 'FFFFFF', `https://www.patreon.com/${gh}`)}
</p>

<p align="center">
  ${link(PROFILE.website, img('assets/footer.svg', 'Thanks for visiting', 'width="100%"'))}
</p>

<p align="center">${link('#top', img('assets/back-to-top.svg', 'Back to top', 'width="200"'))}</p>
`;
}

// ═════════════════════════════ BUILD ═════════════════════════════
// `--stats-only` is what the daily profile-stats workflow runs: refresh the numbers and the strip, nothing else.
const statsOnly = process.argv.includes('--stats-only');
await loadResources();
const STATS = await fetchStats();
if (statsOnly) {
  writeFileSync(join(ASSETS, 'stats.svg'), await statsSvg(STATS));
  console.log('assets/stats.svg refreshed', STATS);
  process.exit(0);
}
for (const dir of ['headers', 'experience', 'projects', 'education', 'connect', 'contact', 'separators']) mkdirSync(join(ASSETS, dir), { recursive: true });

const outputs = {
  'hero.svg': await heroSvg(),
  'stats.svg': await statsSvg(STATS),
  'credentials.svg': await credentialsSvg(),
  'back-to-top.svg': await backToTopSvg(),
  'summary.svg': await summarySvg(),
  'featured.svg': await featuredSvg(),
  'primary-stack.svg': await primaryStackSvg(),
  'skills.svg': await skillsSvg(),
  'languages.svg': await languagesSvg(),
  'principles.svg': await principlesSvg(),
  'impact.svg': await impactSvg(),
  'timeline.svg': await timelineSvg(),
  'milestones.svg': await milestonesSvg(),
  'roadmap.svg': await roadmapSvg(),
  'footer.svg': await footerSvg(),
  'spacer.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="165" viewBox="0 0 20 165"/>',
  // 10x1 gap: adds horizontal space between inline images without adding row height
  'gap.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="1" viewBox="0 0 10 1"/>',
};
for (const [i, sec] of SECTIONS.entries()) outputs[`headers/${String(i + 1).padStart(2, '0')}-${sec.id}.svg`] = await headerSvg(sec, i);
for (const r of EXPERIENCE) outputs[`experience/${r.id}.svg`] = await experienceSvg(r);
const projectH = Math.ceil(Math.max(...PROJECTS.map(projectHeight)));
for (const p of PROJECTS) outputs[`projects/${p.id}.svg`] = await projectSvg(p, projectH);
for (const e of EDUCATION) outputs[`education/${e.id}.svg`] = await educationSvg(e);
for (const c of CONNECT) outputs[`connect/${c.id}.svg`] = await connectTileSvg(c);
for (const [i, c] of CONTACT.entries()) outputs[`contact/${c.id}.svg`] = await contactButtonSvg(c, i);
for (const sep of SEPARATORS) outputs[`separators/${sep.id}.svg`] = await separatorSvg(sep);

for (const [name, svg] of Object.entries(outputs)) {
  writeFileSync(join(ASSETS, name), svg);
  console.log(`assets/${name}`.padEnd(36), `${(svg.length / 1024).toFixed(1)} KB`);
}
writeFileSync(join(ROOT, 'README.md'), readme());
console.log('README.md written');
