import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_DOMAIN = 'https://app.realtymedia.ro';
const DEFAULT_SCOPE = 'famescale';
const RETRY_DELAY_MS = 2_500;
const RETRY_COUNT = 12;
const DEFAULT_ARTIFACT = 'dist/index.html';

function usage() {
  console.error(
    'Usage: npm run release:verify -- <ready-deployment-url> [--repair] [--domain <url>] [--scope <team>] [--artifact <html-file>]',
  );
}

function parseArgs(args) {
  const options = {
    deploymentUrl: undefined,
    domainUrl: DEFAULT_DOMAIN,
    scope: DEFAULT_SCOPE,
    artifactPath: DEFAULT_ARTIFACT,
    repair: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--repair') {
      options.repair = true;
    } else if (argument === '--domain') {
      options.domainUrl = args[++index];
    } else if (argument === '--scope') {
      options.scope = args[++index];
    } else if (argument === '--artifact') {
      options.artifactPath = args[++index];
    } else if (!argument.startsWith('--') && !options.deploymentUrl) {
      options.deploymentUrl = argument;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }

  if (!options.deploymentUrl || !options.domainUrl || !options.scope || !options.artifactPath) {
    throw new Error('A deployment URL, domain URL, scope, and artifact path are required.');
  }

  return options;
}

function normalizeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Expected an HTTP(S) URL, received: ${value}`);
  }
  return url.toString().replace(/\/$/, '');
}

function assetSignature(html, sourceUrl) {
  if (!/\/_expo\/static\/css\/workspace-[a-f0-9]+\.css/.test(html)) {
    throw new Error(`${sourceUrl} does not contain the SaaS workspace stylesheet.`);
  }
  const matches = html.match(/\/_expo\/static\/(?:css|js)\/[^"'\s<]+\.(?:css|js)/gi);
  const assets = [...new Set(matches ?? [])].sort();

  if (assets.length === 0) {
    throw new Error(`Could not find a hashed app asset manifest in ${sourceUrl}.`);
  }

  return createHash('sha256').update(assets.join(',')).digest('hex');
}

async function getSignature(url) {
  const response = await fetch(url, {
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}.`);
  }

  return assetSignature(await response.text(), url);
}

function getAliasTarget(domainUrl, scope) {
  const domain = new URL(domainUrl).hostname;
  let result;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    result = spawnSync(
      'npx',
      ['vercel', 'alias', 'ls', '--scope', scope, '--format', 'json'],
      { encoding: 'utf8' },
    );

    if (result.status === 0) break;
  }

  if (!result || result.status !== 0) {
    throw new Error(`Vercel could not read aliases for ${domain}.`);
  }

  const jsonStart = result.stdout.indexOf('{');
  if (jsonStart === -1) {
    throw new Error(`Vercel did not return alias JSON for ${domain}.`);
  }

  const aliases = JSON.parse(result.stdout.slice(jsonStart)).aliases ?? [];
  const target = aliases.find((alias) => alias.alias === domain);

  if (!target?.url) {
    throw new Error(`Vercel has no deployment alias for ${domain}.`);
  }

  return target.url;
}

function getArtifactSignature(artifactPath) {
  const absolutePath = resolve(artifactPath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Release artifact not found at ${absolutePath}. Run npm run build:web first.`);
  }

  return assetSignature(readFileSync(absolutePath, 'utf8'), absolutePath);
}

async function verifyDomain(deploymentUrl, domainUrl, scope) {
  const deployment = new URL(deploymentUrl).hostname;
  const aliasTarget = getAliasTarget(domainUrl, scope);
  const domainSignature = await getSignature(domainUrl);

  return {
    aliasTarget,
    deployment,
    domainSignature,
    matches: aliasTarget === deployment,
  };
}

function attachDomain(deploymentUrl, domainUrl, scope) {
  const domain = new URL(domainUrl).hostname;
  const result = spawnSync(
    'npx',
    ['vercel', 'alias', 'set', deploymentUrl, domain, '--scope', scope],
    { stdio: 'inherit' },
  );

  if (result.status !== 0) {
    throw new Error(`Vercel could not attach ${domain} to ${deploymentUrl}.`);
  }
}

function wait(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const deploymentUrl = normalizeUrl(options.deploymentUrl);
  const domainUrl = normalizeUrl(options.domainUrl);
  // Confirm the locally built artifact contains an Expo manifest. Vercel protects
  // unique deployment URLs, so comparing their fetched HTML is not reliable.
  const artifactSignature = getArtifactSignature(options.artifactPath);
  let result = await verifyDomain(deploymentUrl, domainUrl, options.scope);

  if (result.matches) {
    console.log(`Verified ${domainUrl} serves Expo assets (${result.domainSignature}) from ${result.deployment}; local artifact manifest: ${artifactSignature}.`);
    return;
  }

  console.error(`Release mismatch: ${domainUrl} points to ${result.aliasTarget}, but the ready deployment is ${result.deployment}.`);

  if (!options.repair) {
    throw new Error(`Run this check again with --repair to attach ${domainUrl} to the ready deployment.`);
  }

  console.log(`Attaching ${domainUrl} to ${deploymentUrl}…`);
  attachDomain(deploymentUrl, domainUrl, options.scope);

  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    await wait(RETRY_DELAY_MS);
    result = await verifyDomain(deploymentUrl, domainUrl, options.scope);

    if (result.matches) {
      console.log(`Verified ${domainUrl} serves Expo assets (${result.domainSignature}) from ${result.deployment} after alias repair.`);
      return;
    }

    console.log(`Alias propagation pending (${attempt}/${RETRY_COUNT})…`);
  }

  throw new Error(`Alias repair completed, but ${domainUrl} still does not serve ${deploymentUrl}'s build.`);
}

main().catch((error) => {
  usage();
  console.error(error.message);
  process.exitCode = 1;
});
