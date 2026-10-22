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

const SECTIONS = [
  { id: 'summary', title: 'Summary', cmd: 'whoami --verbose', accent: C.blue },
  { id: 'impact', title: 'Impact in Production', cmd: 'SELECT impact FROM prod;', accent: C.green },
  { id: 'timeline', title: 'Career Timeline', cmd: 'git log --graph --career', accent: C.purple },
  { id: 'milestones', title: 'Milestones', cmd: 'git tag --list', accent: C.yellow },
  { id: 'experience', title: 'Experience', cmd: 'cat experience.md', accent: C.blue },
  { id: 'projects', title: 'Key Projects', cmd: 'ls ~/projects --featured', accent: C.orange },
  { id: 'stack', title: 'Tech Stack', cmd: 'pnpm ls --depth=0', accent: C.purple },
  { id: 'ambitions', title: 'Ambitions & Roadmap', cmd: 'git checkout -b next', accent: C.pink },
  { id: 'coding', title: 'Coding Profile', cmd: 'gh api users/shreesharma07', accent: C.green },
  { id: 'wakatime', title: 'WakaTime Insights', cmd: 'wakatime --today', accent: C.blue },
  { id: 'credentials', title: 'Awards & Certifications', cmd: 'cat credentials.json', accent: C.yellow },
  { id: 'education', title: 'Education', cmd: 'history | grep learn', accent: C.orange },
  { id: 'languages', title: 'Languages', cmd: 'locale -a', accent: C.green },
  { id: 'connect', title: "Let's Connect", cmd: 'ping shri', accent: C.blue },
  { id: 'support', title: 'Support My Work', cmd: 'sudo make coffee', accent: C.pink },
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

const FEATURED_REPO = { name: 'numsy', blurb: 'TypeScript toolkit for Indian phone-number data', href: 'https://github.com/shreesharma07/numsy' };

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
  for (const c of CONNECT.filter((c) => c.icon)) {
    brandSvg[c.icon] = await cached(join(CACHE, 'icons', `si-${c.icon}.svg`), `https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/${c.icon}.svg`, false);
  }
  for (const r of ROADMAP.filter((r) => r.icon)) {
    skillSvg[r.icon] = await cached(join(CACHE, 'skillicons', `${r.icon}.svg`), `https://skillicons.dev/icons?i=${r.icon}&theme=dark`, false);
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

/** Milestone stepper: a rail of dated dots, one card per milestone. */
async function milestonesSvg() {
  const W = 1200, gap = 20, n = MILESTONES.length, cw = (W - gap * (n - 1)) / n, railY = 22, cardY = 56, ch = 176;
  const H = cardY + ch;
  const s = new Svg(W, H, `Milestones: ${MILESTONES.map((m) => `${m.title} (${m.date})`).join(', ')}`);
  const cx = (i) => i * (cw + gap) + cw / 2;
  s.defs.push(`<linearGradient id="rail" x1="0" x2="1">${MILESTONES.map((m, i) => `<stop offset="${i / (n - 1)}" stop-color="${m.color}"/>`).join('')}</linearGradient>`);
  s.raw(`<rect class="grow" x="${cx(0)}" y="${railY - 1.5}" width="${cx(n - 1) - cx(0)}" height="3" rx="1.5" fill="url(#rail)" opacity=".7"/>`);
  MILESTONES.forEach((m, i) => {
    const x = i * (cw + gap), delay = `animation-delay:${0.3 + i * 0.15}s`;
    s.raw(`<g class="rise" style="${delay}">`);
    s.raw(`<circle cx="${cx(i)}" cy="${railY}" r="9" fill="${C.bg}" stroke="${m.color}" stroke-width="3"/><circle cx="${cx(i)}" cy="${railY}" r="3.5" fill="${m.color}"/>`);
    s.raw(`<path d="M${cx(i)} ${railY + 10}V${cardY}" stroke="${m.color}" stroke-opacity=".4" stroke-dasharray="2 3"/>`);
    s.raw(cardRect(x, cardY, cw, ch));
    s.text('m6', m.date, { x: x + 24, y: cardY + 40, size: 13, fill: m.color });
    s.text('d7', m.title, { x: x + 24, y: cardY + 78, size: fit('d7', m.title, 20, cw - 48), fill: C.text });
    s.para('d5', m.sub, { x: x + 24, y: cardY + 110, size: 15, max: cw - 48, lead: 1.4 });
    s.raw('</g>');
  });
  return s.render();
}

/** One experience header: role, company, period. Bullets stay in Markdown so they remain searchable. */
async function roleSvg(r) {
  const W = 1200, H = 120;
  const s = new Svg(W, H, `${r.title} at ${r.company}, ${r.period}`);
  s.raw(cardRect(0, 0, W, H));
  s.raw(`<rect x="0" y="28" width="4" height="64" rx="2" fill="${r.color}"/>`);
  const pw = s.pill(r.abbr, { x: 36, y: 26, color: r.color, size: 13, h: 28 });
  const right = measure('m6', r.period, 16) + 40;
  s.text('d7', r.title, { x: 36 + pw + 16, y: 48, size: fit('d7', r.title, 26, W - 36 - pw - 16 - right - 60), fill: C.text });
  s.runs('d5', [[r.company, r.color], ['   ·   ', C.faint], [r.location, C.muted]], { x: 36, y: 90, size: 17 });
  s.text('m6', r.period, { x: W - 36, y: 46, size: 16, fill: C.text, anchor: 'end' });
  s.text('m4', r.focus, { x: W - 36, y: 88, size: 13, fill: C.faint, anchor: 'end' });
  if (r.note) s.pill(r.note, { x: W - 36 - measure('m4', r.focus, 13) - 16, y: 70, color: r.color, key: 'm4', size: 12, h: 26, anchor: 'end' });
  return s.render();
}

/** Project card. Transparent background: it sits inside a Markdown table cell. */
async function projectSvg(p) {
  const W = 560, H = 268, X = 8;
  const s = new Svg(W, H, p.title);
  s.raw(`<rect x="${X}" y="16" width="52" height="52" rx="14" fill="${p.color}" fill-opacity=".12" stroke="${p.color}" stroke-opacity=".5"/>`);
  s.text('m6', p.glyph, { x: X + 26, y: 48, size: 17, fill: p.color, anchor: 'middle' });
  s.text('d7', p.title, { x: X + 72, y: 40, size: fit('d7', p.title, 24, W - X - 80), fill: C.text });
  s.text('m4', p.context, { x: X + 72, y: 64, size: 13, fill: C.faint });
  s.para('d5', p.body, { x: X, y: 112, size: 17, max: W - X * 2 - 8, fill: C.muted, lead: 1.5 });
  const mw = (W - X * 2 - 24) / 3;
  p.metrics.forEach(([v, l], i) => {
    const mx = X + i * (mw + 12);
    s.raw(`<g class="rise" style="animation-delay:${0.1 + i * 0.1}s">${cardRect(mx, 176, mw, 80, { rx: 12, fill: 'none', stroke: C.border })}`);
    s.text('d7', v, { x: mx + 18, y: 214, size: 26, fill: p.color });
    s.text('m4', l, { x: mx + 18, y: 240, size: fit('m4', l, 12.5, mw - 30), fill: C.faint });
    s.raw('</g>');
  });
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

  // right: fact sheet
  const rx = lw + gap, rowH = 46, rowsTop = 84;
  s.text('m6', 'AT A GLANCE', { x: rx + pad, y: 56, size: 13, fill: C.purple });
  SUMMARY.facts.forEach(([k, v], i) => {
    const y = rowsTop + i * rowH;
    if (i) s.raw(`<path d="M${rx + pad} ${y}H${W - pad}" stroke="${C.hair}"/>`);
    s.text('m4', k, { x: rx + pad, y: y + 29, size: 12, fill: C.faint });
    s.text('d6', v, { x: W - pad, y: y + 30, size: fit('d6', v, 16, rw - pad * 2 - 110), fill: C.text, anchor: 'end' });
  });

  const H = Math.ceil(Math.max(bodyEnd + pad + 4, rowsTop + SUMMARY.facts.length * rowH + pad - 8));
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

/** A linked skillicons.dev icon: one image per tech so each carries its own link. */
const skill = (key, size = 48) => link(TECH[key].href, img(`https://skillicons.dev/icons?i=${TECH[key].icon}&theme=dark`, TECH[key].label, `width="${size}" title="${xml(TECH[key].label)}"`));
const skillRow = (keys) => keys.map((k) => skill(k)).join('&nbsp;\n  ');

const brandChip = (label, logo, logoColor, href, height = 32) =>
  link(href, img(badge({ label, color: '161b22', logo, logoColor }), label, `height="${height}"`));

const sectionHeader = (sec) => {
  const i = SECTIONS.indexOf(sec);
  return `<a id="${sec.id}"></a>\n<p align="center">${img(`assets/headers/${String(i + 1).padStart(2, '0')}-${sec.id}.svg`, sec.title, 'width="100%"')}</p>`;
};
const H = Object.fromEntries(SECTIONS.map((s) => [s.id, sectionHeader(s)]));
const gapRow = '<p></p>';

// ═════════════════════════════ README ═════════════════════════════
function experienceBlock(r) {
  const more = r.more.length
    ? `\n<details>\n<summary><sub>More highlights</sub></summary>\n<ul>\n${r.more.map((m) => `<li>${m}</li>`).join('\n')}\n</ul>\n</details>`
    : '';
  return `<p align="center">${link(r.href, img(`assets/experience/${r.id}.svg`, `${r.title} at ${r.company}, ${r.period}`, 'width="100%"'))}</p>

<table align="center">
<tr>
<td width="66%" valign="top">
<ul>
${r.highlights.map((h) => `<li>${h}</li>`).join('\n')}
</ul>${more}
</td>
<td width="34%" valign="top" align="center">
<sub><b>STACK</b></sub><br><br>
${techRow(r.stack, { style: 'flat-square' }, '\n')}
</td>
</tr>
</table>`;
}

function readme() {
  const gh = PROFILE.github;
  const statsTheme = 'theme=github_dark&bg_color=0d1117&border_color=30363d&title_color=58a6ff&icon_color=a371f7&text_color=c9d1d9&border_radius=16';
  const typing =
    'https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=500&size=19&duration=3200&pause=1000&color=58A6FF&center=true&vCenter=true&width=720&lines=' +
    [
      'Backend Engineer (SDE-3) @ OneCX',
      'Real-time · event-driven · search',
      'NestJS · PostgreSQL · Kafka · Redis',
      'Next up → Rust · Go · Spring Boot · DevOps · SEO',
    ]
      .map((l) => encodeURIComponent(l).replace(/%20/g, '+'))
      .join(';');
  const stackTable = [
    ['Backend & APIs', ['nodejs', 'typescript', 'javascript', 'nestjs', 'express', 'graphql', 'grpc', 'socketio', 'openapi', 'whatsapp', 'postman']],
    ['Databases & ORMs', ['postgres', 'mysql', 'mongodb', 'sqlite', 'cassandra', 'rds', 'redshift', 'typeorm', 'prisma', 'zod', 'firebase']],
    ['Messaging & search', ['kafka', 'rabbitmq', 'bullmq', 'redis', 'pubsub', 'elasticsearch', 'kibana']],
    ['Cloud & delivery', ['aws', 'lambda', 'cloudwatch', 'docker', 'nginx', 'pm2', 'linode', 'vercel', 'actions', 'circleci', 'ado', 'husky']],
    ['Observability & testing', ['prometheus', 'grafana', 'jest', 'vitest', 'playwright', 'jwt', 'oauth']],
    ['Tooling', ['git', 'github', 'gitlab', 'bitbucket', 'jira', 'mermaid', 'figma']],
    ['Web, analytics & SEO', ['astro', 'cloudflare', 'analytics', 'posthog', 'searchconsole']],
    ['AI-assisted', ['claude', 'mcp', 'copilot', 'cursor']],
    ['Also shipped with', ['react', 'nextjs', 'tailwind', 'bootstrap']],
  ]
    .map(([cat, keys]) => `<tr>\n<td align="center"><br><sub><b>${xml(cat).toUpperCase()}</b></sub><br><br>\n${techRow(keys, {}, '\n')}\n<br><br>\n</td>\n</tr>`)
    .join('\n');

  const projectCell = (p) => `<td width="50%" valign="top" align="center">
${img(`assets/projects/${p.id}.svg`, `${p.title}: ${p.body}`, 'width="100%"')}
<br><br>
${techRow(p.stack, { style: 'flat-square' }, '\n')}
<br><br>
</td>`;

  return `<!--
  Generated by tools/build-profile.mjs. Edit the data there, then run:
    cd tools && npm install && npm run build
-->
<a id="top"></a>

<p align="center">
  ${link(PROFILE.website, img('assets/hero.svg', `${PROFILE.name}, ${PROFILE.role}`, 'width="100%"'))}
</p>

<p align="center">
  ${link(PROFILE.website, img(typing, 'Backend Engineer (SDE-3) at OneCX'))}
</p>

<p align="center">
  ${link(PROFILE.website, img(badge({ label: 'shrikumarsharma.in', color: '1f6feb', logo: 'googlechrome' }), 'Portfolio', 'height="30"'))}&nbsp;
  ${link(PROFILE.blog, img(badge({ label: 'Blog', color: '8957e5', logo: 'rss' }), 'Blog', 'height="30"'))}&nbsp;
  ${link(`mailto:${PROFILE.email}`, img(badge({ label: 'Email', color: 'da3633', logo: 'gmail' }), 'Email', 'height="30"'))}&nbsp;
  ${link(PROFILE.linkedin, img(badge({ label: 'LinkedIn', color: '0a66c2', logo: 'linkedin' }), 'LinkedIn', 'height="30"'))}
</p>

<p align="center">
  ${link(PROFILE.uptimePage, img(PROFILE.uptimeBadge, 'Portfolio uptime'))}&nbsp;
  ${link(`https://github.com/${gh}`, img(`https://komarev.com/ghpvc/?username=${gh}&color=1f6feb&label=profile+views&style=flat-square&abbreviated=true`, 'Profile views'))}&nbsp;
  ${link(`https://wakatime.com/@${gh}`, img(`https://wakatime.com/badge/user/${PROFILE.wakatimeId}.svg?style=flat-square`, 'WakaTime total'))}&nbsp;
  ${link(`https://github.com/${gh}?tab=followers`, img(`https://img.shields.io/github/followers/${gh}?style=flat-square&logo=github&logoColor=white&label=followers&labelColor=161b22&color=1f6feb`, 'Followers'))}&nbsp;
  ${link(`https://github.com/${gh}?tab=repositories`, img(`https://img.shields.io/github/stars/${gh}?style=flat-square&logo=github&logoColor=white&label=stars&labelColor=161b22&color=e3b341`, 'Stars'))}
</p>

${H.summary}

<p align="center">${img('assets/summary.svg', `${SUMMARY.headline} ${SUMMARY.body}`, 'width="100%"')}</p>

<p align="center">
  ${link(FEATURED_REPO.href, img(badge({ label: `Featured repo · ${FEATURED_REPO.name}`, message: FEATURED_REPO.blurb, labelColor: '1f6feb', logo: 'github', style: 'flat-square' }), `${FEATURED_REPO.name}: ${FEATURED_REPO.blurb}`, 'height="24"'))}
</p>

<p align="center">${img('assets/principles.svg', 'How I work: own the full backend, design with the client, prove it with a POC, write it down', 'width="100%"')}</p>

${H.impact}

<p align="center">${img('assets/impact.svg', 'Impact: ~12M entries indexed, 40% lower search latency, 35% faster APIs, 50% faster incident detection, 99.9% uptime, 1M+ messages per quarter, 10x reach, 250K emails in under 10 minutes', 'width="100%"')}</p>

${H.timeline}

<p align="center">${img('assets/timeline.svg', 'Career timeline from 2017 to present', 'width="100%"')}</p>

${H.milestones}

<p align="center">${img('assets/milestones.svg', MILESTONES.map((m) => `${m.date}: ${m.title}, ${m.sub}`).join('; '), 'width="100%"')}</p>

${H.experience}

${EXPERIENCE.map(experienceBlock).join(`\n\n${gapRow}\n\n`)}

${H.projects}

<table align="center">
<tr>
${projectCell(PROJECTS[0])}
${projectCell(PROJECTS[1])}
</tr>
<tr>
${projectCell(PROJECTS[2])}
${projectCell(PROJECTS[3])}
</tr>
</table>

${H.stack}

<p align="center">
  ${skillRow(['typescript', 'nodejs', 'nestjs', 'express', 'graphql', 'postgres', 'mongodb', 'redis', 'kafka', 'rabbitmq'])}
</p>
<p align="center">
  ${skillRow(['elasticsearch', 'prisma', 'aws', 'cloudflare', 'docker', 'actions', 'prometheus', 'grafana', 'vitest', 'astro'])}
</p>

${gapRow}

<table align="center">
${stackTable}
</table>

${H.ambitions}

<p align="center">${img('assets/roadmap.svg', 'Roadmap: Rust, Go, Spring Boot, DevOps and SEO', 'width="100%"')}</p>

<p align="center">
  ${link('https://doc.rust-lang.org/book/', img(badge({ label: 'The Rust Book', logo: 'rust', style: 'flat-square' }), 'The Rust Book'))}&nbsp;
  ${link('https://go.dev/tour/', img(badge({ label: 'A Tour of Go', logo: 'go', logoColor: '00ADD8', style: 'flat-square' }), 'A Tour of Go'))}&nbsp;
  ${link('https://spring.io/guides', img(badge({ label: 'Spring Guides', logo: 'springboot', logoColor: '6DB33F', style: 'flat-square' }), 'Spring Guides'))}&nbsp;
  ${techRow(['kubernetes', 'terraform', 'helm'], { style: 'flat-square' }, '&nbsp;\n  ')}
</p>
<p align="center">
  ${techRow(['argocd', 'cwv', 'lighthouse', 'searchconsole'], { style: 'flat-square' }, '&nbsp;\n  ')}
</p>

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

<!-- 3D contribution calendar: .github/workflows/profile-3d.yml commits it to ./profile-3d-contrib. -->
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

<table align="center">
<tr>
<td colspan="2" align="center">${link(`https://wakatime.com/@${gh}`, img(`https://github-readme-stats.vercel.app/api/wakatime?username=${gh}&layout=compact&langs_count=8&card_width=1000&custom_title=All-time+languages&${statsTheme}`, 'WakaTime all-time languages', 'width="100%"'))}</td>
</tr>
<tr>
<td width="50%" align="center" valign="top"><sub><b>LANGUAGES · SHARE</b></sub><br><br>${link(`https://wakatime.com/@${gh}`, img(PROFILE.wakatimeShares.pie, 'WakaTime languages pie chart', 'width="100%"'))}</td>
<td width="50%" align="center" valign="top"><sub><b>LANGUAGES · HOURS</b></sub><br><br>${link(`https://wakatime.com/@${gh}`, img(PROFILE.wakatimeShares.bar, 'WakaTime languages bar chart', 'width="100%"'))}</td>
</tr>
<tr>
<td colspan="2" align="center"><sub><b>ALL TIME CODING ACTIVITY</b></sub><br><br>${link(`https://wakatime.com/@${gh}`, img(PROFILE.wakatimeShares.activity, 'WakaTime coding activity', 'width="100%"'))}</td>
</tr>
</table>
<!-- More chart types (editors, OS, categories): https://wakatime.com/share/embed, then add each share URL as a new <td>. -->

${H.credentials}

<p align="center">
  ${link(PROFILE.experienceUrl, img(badge({ label: 'PrepStar of the Quarter', message: 'Q2 2022 · PrepLadder', labelColor: '9e6a03', logo: 'starship' }), 'PrepStar of the Quarter, Q2 2022', 'height="36"'))}
  <br><sub>Best-performing individual in the backend engineering team for the quarter.</sub>
</p>

<table align="center">
<tr>
<td width="36%" align="center" valign="top"><sub><b>ANTHROPIC</b></sub><br><br>
${['Claude with the Anthropic API', 'Claude Code in Action', 'Introduction to Agent Skills', 'Introduction to MCP']
  .map((c) => link('https://anthropic.skilljar.com', img(badge({ label: c, logo: 'anthropic', logoColor: 'D97757', style: 'flat-square' }), c)))
  .join('<br>\n')}
</td>
<td width="32%" align="center" valign="top"><sub><b>HACKERRANK</b></sub><br><br>
${[['SQL', 'Advanced'], ['REST API', 'Intermediate'], ['JavaScript', 'Intermediate'], ['Problem Solving', 'Intermediate']]
  .map(([c, l]) => link('https://www.hackerrank.com/shreesharma07', img(badge({ label: c, message: l, labelColor: '161b22', color: '238636', logo: 'hackerrank', style: 'flat-square' }), `${c} (${l})`)))
  .join('<br>\n')}
</td>
<td width="32%" align="center" valign="top"><sub><b>OTHER</b></sub><br><br>
${link(PROFILE.udemyCert, img(badge({ label: 'Ethereum & Solidity', logo: 'udemy', logoColor: 'A435F0', style: 'flat-square' }), 'Ethereum and Solidity, Udemy'))}<br>
${link('https://www.atlassian.com/university', img(badge({ label: 'Jira Fundamentals', logo: 'atlassian', logoColor: '2684FF', style: 'flat-square' }), 'Jira Fundamentals, Atlassian'))}<br>
${link('https://www.atlassian.com/university', img(badge({ label: 'ITSM · Jira Service Mgmt', logo: 'jira', logoColor: '2684FF', style: 'flat-square' }), 'ITSM in Jira Service Management, Atlassian'))}
</td>
</tr>
</table>

<!-- Holopin board, hidden for now:
<p align="center">
  ${link(`https://holopin.io/@${gh}`, img(`https://holopin.me/${gh}`, 'Holopin badges', 'width="60%"'))}
</p>
-->

${H.education}

<p align="center">
  ${EDUCATION.map((e) => link(e.href, img(`assets/education/${e.id}.svg`, `${e.degree}, ${e.school}`, 'width="49%"'))).join('\n  ')}
</p>

${H.languages}

<p align="center">${img('assets/languages.svg', LANGUAGES.map((l) => `${l.name}: ${l.level}`).join('. '), 'width="100%"')}</p>

${H.connect}

<p align="center">Open to collaboration and work inquiries. Pick whichever channel suits you.</p>

<!-- Seven tiles at 13.4% with six 1.03% spacers fill one row; no whitespace between tags. -->
<p align="center">${CONNECT.map((c) => link(c.href, img(`assets/connect/${c.id}.svg`, `${c.label}: ${c.handle}`, 'width="13.4%"'))).join(img('assets/spacer.svg', '', 'width="1.03%"'))}</p>

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

<p align="center"><sub><a href="#top">↑ back to top</a></sub></p>
`;
}

// ═════════════════════════════ BUILD ═════════════════════════════
await loadResources();
for (const dir of ['headers', 'experience', 'projects', 'education', 'connect']) mkdirSync(join(ASSETS, dir), { recursive: true });

const outputs = {
  'hero.svg': await heroSvg(),
  'summary.svg': await summarySvg(),
  'languages.svg': await languagesSvg(),
  'principles.svg': await principlesSvg(),
  'impact.svg': await impactSvg(),
  'timeline.svg': await timelineSvg(),
  'milestones.svg': await milestonesSvg(),
  'roadmap.svg': await roadmapSvg(),
  'footer.svg': await footerSvg(),
  'spacer.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="165" viewBox="0 0 20 165"/>',
};
for (const [i, sec] of SECTIONS.entries()) outputs[`headers/${String(i + 1).padStart(2, '0')}-${sec.id}.svg`] = await headerSvg(sec, i);
for (const r of EXPERIENCE) outputs[`experience/${r.id}.svg`] = await roleSvg(r);
for (const p of PROJECTS) outputs[`projects/${p.id}.svg`] = await projectSvg(p);
for (const e of EDUCATION) outputs[`education/${e.id}.svg`] = await educationSvg(e);
for (const c of CONNECT) outputs[`connect/${c.id}.svg`] = await connectTileSvg(c);

for (const [name, svg] of Object.entries(outputs)) {
  writeFileSync(join(ASSETS, name), svg);
  console.log(`assets/${name}`.padEnd(36), `${(svg.length / 1024).toFixed(1)} KB`);
}
writeFileSync(join(ROOT, 'README.md'), readme());
console.log('README.md written');
