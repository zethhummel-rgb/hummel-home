import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, createReadStream, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const repository = 'zethhummel-rgb/hummel-home';
const workflow = '.github/workflows/hh-release.yml';
const ref = 'refs/heads/main';
const appOrigin = 'https://test.hhfamily.ca';
const pagesProject = 'hh-family-domain-test';
const supabaseOrigin = 'https://ybizqfghnplcxlmlhvyn.supabase.co';
const testPublishableKey = 'sb_publishable_jbLSo5LPkS9k06Fx1txlBQ_3rWWkWh_';
const markerFile = 'hh-release.json';
const archiveFile = 'hh-test-release.tar.gz';
const paths = {
  app: /^assets\/app-[A-Za-z0-9_-]+\.js$/,
  admin: /^assets\/admin-[A-Za-z0-9_-]+\.js$/,
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const shaPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const versionPattern = /^V(0|[1-9][0-9]{0,5})\.[0-9]$/;
const runPattern = /^[1-9][0-9]{0,19}$/;
const forbiddenPath = /(?:^|\/)(?:CNAME|_redirects|_worker\.js|\.env(?:\.[^/]*)?|\.git)(?:\/|$)/i;

function check(value, message) {
  if (!value) throw Error(message);
}

export function checkWorkflow(env) {
  check(env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'workflow_dispatch'
    && env.GITHUB_REPOSITORY === repository && env.GITHUB_REF === ref
    && env.GITHUB_WORKFLOW_REF === `${repository}/${workflow}@${ref}`
    && shaPattern.test(env.GITHUB_SHA ?? '') && runPattern.test(env.GITHUB_RUN_ID ?? ''),
  'HH releases must run from the trusted main workflow in the HH TEST repository.');
}

function checkBuildIdentity({id, version, commit_sha}) {
  check(uuid.test(id ?? '') && versionPattern.test(version ?? '') && shaPattern.test(commit_sha ?? ''),
    'The release identity is invalid.');
}

function checkRegisteredArtifact(release) {
  checkBuildIdentity(release);
  check(typeof release.artifact_run_id === 'string' && runPattern.test(release.artifact_run_id)
    && digestPattern.test(release.artifact_sha256 ?? ''), 'The release artifact is invalid.');
}

function namesFromBuild(directory, prefix = '') {
  return readdirSync(join(directory, prefix), {withFileTypes:true}).flatMap(entry => {
    const name = prefix + entry.name;
    check(/^[A-Za-z0-9_.-]+$/.test(entry.name) && !forbiddenPath.test(name), 'Unexpected deploy file name.');
    if (entry.isDirectory()) return namesFromBuild(directory, name + '/');
    check(entry.isFile(), 'A deploy file is not a regular file.');
    return [name];
  });
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function digestFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function noindex(value) {
  return /(?:^|[,\s])noindex(?:[,\s]|$)/i.test(value ?? '');
}

function pageAsset(html, kind) {
  const modules = [...html.matchAll(/<script\b[^>]*\bsrc=["']\.\/([^"']+)["'][^>]*>/gi)]
    .map(match => match[1]).filter(asset => paths[kind].test(asset));
  check(modules.length === 1, 'Could not find the expected built script.');
  return modules[0];
}

export function inspectTestBuild(directory, identity) {
  checkBuildIdentity(identity);
  const files = namesFromBuild(directory);
  const index = readFileSync(join(directory,'index.html'),'utf8');
  const admin = readFileSync(join(directory,'admin.html'),'utf8');
  const manifest = JSON.parse(readFileSync(join(directory,'manifest.webmanifest'),'utf8'));
  const headers = readFileSync(join(directory,'_headers'),'utf8');
  check(index.includes('<title>HH Test — Humble Home App</title>') && manifest.short_name === 'HH Test'
    && files.includes('test-guide.html') && /\/\*\r?\n[ \t]+X-Robots-Tag:.*\bnoindex\b/i.test(headers),
  'The build is missing the TEST app or its noindex protection.');
  let hasTestBackend = false;
  let hasVersion = false;
  for (const file of files.filter(name => /^assets\/.+\.js$/.test(name))) {
    const code = readFileSync(join(directory,file),'utf8');
    hasTestBackend ||= code.includes(supabaseOrigin);
    hasVersion ||= ['"', "'", '\u0060'].some(quote => code.includes(quote+identity.version+quote));
  }
  check(hasTestBackend && hasVersion, 'The built app does not contain the expected TEST backend and version.');
  const appAsset = pageAsset(index,'app');
  const adminAsset = pageAsset(admin,'admin');
  return {
    target:'test', repository, id:identity.id, version:identity.version, commit_sha:identity.commit_sha,
    app_asset:appAsset, app_sha256:digest(readFileSync(join(directory,appAsset))),
    admin_asset:adminAsset, admin_sha256:digest(readFileSync(join(directory,adminAsset))),
  };
}

function sameMarker(actual, expected) {
  return Object.keys(actual ?? {}).length === Object.keys(expected).length
    && Object.entries(expected).every(([key,value]) => actual?.[key] === value);
}

function output(fields) {
  const lines = Object.entries(fields).map(([key,value]) => {
    check(/^[A-Za-z0-9._/-]+$/.test(String(value)), 'Invalid GitHub output value.');
    return `${key}=${value}\n`;
  });
  appendFileSync(process.env.GITHUB_OUTPUT, lines.join(''));
}

function workingPath(...names) {
  check(process.env.RUNNER_TEMP, 'A GitHub runner temp path is required.');
  return resolve(process.env.RUNNER_TEMP,...names);
}

export function packTestArchive(directory, destination, identity) {
  const marker = inspectTestBuild(directory,identity);
  writeFileSync(join(directory,markerFile),JSON.stringify(marker,null,2)+'\n',{flag:'wx'});
  appendFileSync(join(directory,'_headers'),`\n/${markerFile}\n  Cache-Control: no-store\n`);
  // GNU tar in the Ubuntu runner fixes file order, time, ownership and modes.
  execFileSync('tar',['--sort=name','--format=ustar','--mtime=@0','--owner=0','--group=0',
    '--numeric-owner','--mode=go=rX,u=rwX','-czf',destination,'-C',directory,'.']);
}

async function prepare() {
  const commit_sha = process.env.GITHUB_SHA;
  check(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()===commit_sha, 'The build checkout does not match its workflow commit.');
  const version = readFileSync('src/releaseVersion.ts','utf8').match(/^export const appReleaseVersion = '([^']+)';$/m)?.[1];
  const id = randomUUID();
  const identity = {id, version, commit_sha};
  const destination = workingPath(archiveFile);
  packTestArchive(resolve('dist'), destination, identity);
  const artifact_sha256 = await digestFile(destination);
  await unpackTestArchive(destination, workingPath('hh-release-package-check'), {
    ...identity, artifact_sha256, artifact_run_id: process.env.GITHUB_RUN_ID,
  });
  output({...identity, artifact_sha256});
}

async function worker(action,payload) {
  const key = process.env.HH_RELEASE_WORKER_KEY;
  check(key && !/\s/.test(key),'The protected TEST release worker key is missing.');
  for (let attempt=1;attempt<=3;attempt++) {
    try {
      const response = await fetch(`${supabaseOrigin}/functions/v1/hh-release-dispatch`,{
        method:'POST', redirect:'error', signal:AbortSignal.timeout(15000),
        headers:{authorization:`Bearer ${key}`,apikey:testPublishableKey,'content-type':'application/json'},
        body:JSON.stringify({action:'worker',worker_action:action,payload}),
      });
      if (response.ok) return await response.json();
      // The claim receipt is returned only to the winner, so never retry a claim after an ambiguous failure.
      if (response.status < 500 || action==='claim' || attempt===3) {
        throw Error(`The TEST release worker rejected ${action} (HTTP ${response.status}).`);
      }
    } catch (error) {
      if (action==='claim'||attempt===3||error.message.startsWith('The TEST release worker rejected')) throw error;
    }
    await delay(attempt*1000);
  }
}

async function register() {
  const artifact = {
    id:process.env.HH_RELEASE_ID,
    version:process.env.HH_RELEASE_VERSION,
    commit_sha:process.env.GITHUB_SHA,
    artifact_run_id:process.env.GITHUB_RUN_ID,
    artifact_sha256:process.env.HH_RELEASE_ARTIFACT_SHA256,
  };
  checkRegisteredArtifact(artifact);
  const result = await worker('register',artifact);
  check(result?.release?.id===artifact.id,'The TEST release candidate was not registered.');
}

async function claim() {
  const id = process.env.HH_RELEASE_ID;
  check(uuid.test(id ?? ''),'Choose a valid TEST release ID.');
  const result = await worker('claim',{id});
  check(typeof result?.claimed==='boolean' && result.release?.id===id,'The release worker returned an invalid claim.');
  if (!result.claimed) {
    output({claimed:false});
    return;
  }
  check(uuid.test(result.claim_id ?? ''),'The deploy claim receipt is invalid.');
  writeFileSync(workingPath('hh-release-claim.json'),JSON.stringify(result),{flag:'wx',mode:0o600});
  output({claimed:true});
  checkRegisteredArtifact(result.release);
  output({
    artifact_run_id: result.release.artifact_run_id,
    artifact_name: `hh-test-release-${id}`,
    commit_sha: result.release.commit_sha,
  });
}

function receipt() {
  return JSON.parse(readFileSync(workingPath('hh-release-claim.json'),'utf8'));
}

async function checkPagesProject() {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  check(/^[a-f0-9]{32}$/.test(account ?? '') && token && !/\s/.test(token),
    'Set the protected HH TEST Pages credentials before releasing.');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${pagesProject}`, {
    redirect: 'error', signal: AbortSignal.timeout(12000), headers: {authorization: `Bearer ${token}`},
  });
  check(response.ok, 'The TEST Pages project could not be confirmed with Cloudflare.');
  const {success, result} = await response.json();
  const testHost = new URL(appOrigin).hostname;
  check(success && result?.name === pagesProject && result.production_branch === 'main'
    && Array.isArray(result.domains) && result.domains.includes(testHost)
    && result.domains.every(domain => [testHost, `${pagesProject}.pages.dev`].includes(domain)),
  'The Cloudflare project must publish main only to the expected TEST site.');
}

async function checkArtifactRun() {
  const {release} = receipt();
  checkRegisteredArtifact(release);
  const token = process.env.GITHUB_TOKEN;
  check(token,'A repository-scoped GitHub Actions read token is required.');
  const url = `https://api.github.com/repos/${repository}/actions/runs/${release.artifact_run_id}`;
  for (let attempt=0;attempt<8;attempt++) {
    const response = await fetch(url,{redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{authorization:`Bearer ${token}`,accept:'application/vnd.github+json'}});
    check(response.ok,'The registered build run could not be found.');
    const run = await response.json();
    check(run.head_sha===release.commit_sha && run.head_branch==='main' && run.event==='workflow_dispatch'
      && [workflow, `${workflow}@main`, `${workflow}@refs/heads/main`].includes(run.path)
      && run.repository?.full_name===repository,'The registered artifact did not originate from the trusted TEST workflow.');
    if (run.status==='completed') {
      check(run.conclusion==='success','The registered build run did not pass.');
      return;
    }
    await delay(5000);
  }
  throw Error('The registered build run is still finishing. Retry after it succeeds.');
}

export async function unpackTestArchive(archive, directory, release) {
  checkRegisteredArtifact(release);
  check(await digestFile(archive)===release.artifact_sha256,'The downloaded archive checksum does not match the approved record.');
  const names=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trimEnd().split(/\r?\n/);
  check(names.every(name=>name==='./'||(/^\.\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*\/?$/.test(name)
    && !name.slice(2).split('/').some(part=>part==='.'||part==='..')&&!forbiddenPath.test(name))),
  'The approved archive contains an unsafe path.');
  const listing=execFileSync('tar',['-tvzf',archive],{encoding:'utf8'}).trimEnd().split(/\r?\n/);
  check(listing.every(line=>line.startsWith('d')||line.startsWith('-')),'The approved archive contains linked or special files.');
  mkdirSync(directory);
  execFileSync('tar',['-k','-xzf',archive,'-C',directory,'--no-same-owner','--no-same-permissions']);
  const marker=inspectTestBuild(directory,release);
  check(sameMarker(JSON.parse(readFileSync(join(directory,markerFile),'utf8')),marker),'The extracted marker does not identify the approved TEST release.');
}

async function verifyHosted() {
  const {release}=receipt();
  const marker=inspectTestBuild(workingPath('hh-release-content'),release);
  async function download(path) {
    const url=new URL(path,appOrigin);
    url.searchParams.set('hh_release',release.id);
    const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
    check(response.ok&&noindex(response.headers.get('x-robots-tag')),'The TEST site is missing the expected response and noindex header.');
    return response;
  }
  for (let attempt=0;attempt<16;attempt++) {
    try {
      const live=await download('/'+markerFile);
      check(sameMarker(await live.json(),marker),'The TEST release marker does not match the approved build.');
      const [app,admin]=await Promise.all([download('/'),download('/admin')]);
      check(pageAsset(await app.text(),'app')===marker.app_asset && pageAsset(await admin.text(),'admin')===marker.admin_asset,
        'The TEST pages do not reference the approved scripts.');
      const [main,adminScript]=await Promise.all([download('/'+marker.app_asset),download('/'+marker.admin_asset)]);
      check(digest(Buffer.from(await main.arrayBuffer()))===marker.app_sha256
        && digest(Buffer.from(await adminScript.arrayBuffer()))===marker.admin_sha256,'The TEST scripts do not match the approved hashes.');
      console.log(`Verified ${release.version} at ${appOrigin}.`);
      return;
    } catch (error) {
      if (attempt===15) throw error;
      await delay(3500);
    }
  }
}

async function deployResult(action) {
  const {release,claim_id}=receipt();
  const identity={id:release.id,claim_id};
  if (action==='verified') await worker(action,{
    ...identity,version:release.version,commit_sha:release.commit_sha,artifact_sha256:release.artifact_sha256,
  });
  else if (action==='failed') await worker(action,{...identity,error:'The TEST deployment did not finish verification.'});
  else await worker(action,identity);
}

async function main(action) {
  checkWorkflow(process.env);
  const tasks = {
    prepare, register, claim, 'check-pages':checkPagesProject, 'check-run':checkArtifactRun,
    unpack:()=>unpackTestArchive(workingPath('hh-release-download',archiveFile),workingPath('hh-release-content'),receipt().release),
    'verify-host':verifyHosted,
    verified:()=>deployResult('verified'), publish:()=>deployResult('publish'), failed:()=>deployResult('failed'),
  };
  check(Object.hasOwn(tasks,action),'Unknown TEST release operation.');
  await tasks[action]();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await main(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
}
