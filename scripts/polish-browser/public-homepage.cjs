const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {launchBrowser} = require('./browser.cjs');

const root = path.resolve('dist');
const scope = '/hummel-home/';
const mediaTypes = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

async function serve(request, response) {
  const {pathname} = new URL(request.url, 'http://localhost');
  if (!pathname.startsWith(scope)) {
    response.writeHead(404).end();
    return;
  }
  const filename = path.resolve(root, pathname.slice(scope.length) || 'index.html');
  if (!filename.startsWith(root + path.sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const body = await fs.readFile(filename);
    response.writeHead(200, {'Content-Type': mediaTypes[path.extname(filename)] || 'application/octet-stream'}).end(body);
  } catch {
    response.writeHead(404).end();
  }
}

async function run() {
  const server = http.createServer(serve);
  let browser;
  try {
    await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const app = origin + scope;
    browser = await launchBrowser();
    const context = await browser.newContext({serviceWorkers: 'block', reducedMotion: 'reduce'});
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    const errors = [];
    const demoRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (new URL(request.url()).origin !== origin || request.method() !== 'GET') demoRequests.push(request.url());
    });
    const out = path.resolve(process.env.HH_POLISH_OUTPUT || 'artifacts/polish');
    await fs.mkdir(out, {recursive: true});

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({width, height: 900});
      const response = await page.goto(app + 'home.html');
      assert.equal(response.status(), 200);
      await page.getByRole('heading', {name: 'What’s the plan?', exact: true}).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Homepage fits width ' + width);
      assert.equal(await page.getByRole('link', {name: 'Sign in', exact: true}).isVisible(), true);
      await page.locator('.hero').getByRole('link', {name: 'Explore HH'}).click();
      assert.equal(new URL(page.url()).hash, '#explore');
      assert.equal(await page.locator('.feature-scene').count(), 2);
      const screens = page.locator('.home-preview img, .app-screen img');
      assert.equal(await screens.count(), 5);
      for (const screen of await screens.all()) {
        await screen.scrollIntoViewIfNeeded();
        assert.equal(await screen.evaluate(async image => { await image.decode(); return image.naturalWidth; }), 780);
      }
      assert.equal(await page.locator('.scene-screens.is-entering').count(), 0, 'Reduced motion skips the entrance animation');
      await page.evaluate(() => window.scrollTo(0, 0));
      if (width === 390 || width === 1440) await page.screenshot({path: path.join(out, 'public-home-' + width + '.png'), fullPage: true});

      const eggs = page.getByRole('checkbox', {name: 'Eggs'});
      assert.equal(await eggs.isVisible(), false);
      await page.getByText('Try a grocery list or RSVP', {exact: true}).click();
      assert.equal(await page.locator('.week-board img').evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode()));
        return images.every(image => image.naturalWidth > 0);
      }), true, 'All demo illustrations load');
      await eggs.check();
      assert.equal(await eggs.isChecked(), true);
      await eggs.uncheck();
      assert.equal(await eggs.isChecked(), false);
      for (const reply of ['Yes', 'Maybe', 'No']) {
        await page.getByText(reply, {exact: true}).click();
        assert.equal(await page.getByRole('radio', {name: reply, exact: true}).isChecked(), true);
        assert.equal(await page.getByRole('status').textContent(), 'Sample reply: ' + reply);
      }
      await page.locator('.hero').getByRole('link', {name: 'Request an invitation'}).click();
      await page.getByRole('heading', {name: 'Request an invitation', exact: true}).waitFor();
      assert.equal(page.url(), app + 'request-invitation.html');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Request page fits width ' + width);
      const draft = await page.getByRole('link', {name: 'Open email draft'}).getAttribute('href');
      assert.equal(draft, 'mailto:hummelhomeapp@gmail.com?subject=HH%20Family%20TEST%20invitation%20request');
      if (width === 390) await page.screenshot({path: path.join(out, 'public-invitation-request-390.png'), fullPage: true});
      await page.getByRole('link', {name: 'Back to HH Family'}).click();
      assert.equal(page.url(), app + 'home.html');
      // Let Firefox finish this navigation before resizing the next viewport.
      await page.waitForLoadState('load');
      await page.getByRole('link', {name: 'More about HH', exact: true}).click();
      await page.waitForLoadState('load');
      assert.equal(page.url(), app + 'about.html');
      await page.getByRole('heading', {name: 'A little more together.', exact: true}).waitFor();
      const chapters = page.locator('.about-chapter');
      assert.equal(await chapters.count(), 3);
      assert.equal(await chapters.first().evaluate(card => getComputedStyle(card).position), 'relative', 'Reduced motion reads as a regular page');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'About page fits width ' + width);
      await page.getByRole('link', {name: 'Take a closer look'}).click();
      assert.equal(new URL(page.url()).hash, '#everyday');
      const aboutScreens = page.locator('.chapter-art img');
      assert.equal(await aboutScreens.count(), 6);
      for (const screen of await aboutScreens.all()) {
        await screen.scrollIntoViewIfNeeded();
        assert.equal(await screen.evaluate(async image => { await image.decode(); return image.naturalWidth; }), 780);
      }
      await page.getByText('Using Google Calendar with HH', {exact: true}).click();
      assert.equal(await page.getByRole('link', {name: 'Read about Google access and privacy'}).getAttribute('href'), './privacy.html#google-calendar');
      if (width === 390 || width === 1440) await page.screenshot({path: path.join(out, 'public-about-' + width + '.png'), fullPage: true});
      await page.getByRole('link', {name: 'Request an invitation', exact: true}).click();
      await page.getByRole('heading', {name: 'Request an invitation', exact: true}).waitFor();
      assert.equal(page.url(), app + 'request-invitation.html');
      await page.goto(app + 'home.html');
    }
    assert.deepEqual(demoRequests, [], 'Public demos never contact a backend or submit data');

    await page.getByRole('link', {name: 'Sign in', exact: true}).click();
    assert.equal(page.url(), app);
    await page.getByRole('heading', {name: 'Welcome home.'}).waitFor();
    assert.equal(await page.getByRole('link', {name: 'Explore HH', exact: true}).getAttribute('href'), './home.html');
    assert.deepEqual(errors, []);

    await page.emulateMedia({reducedMotion: 'no-preference'});
    await page.goto(app + 'home.html');
    const lastScene = page.locator('[data-scroll-screens]').last();
    await lastScene.scrollIntoViewIfNeeded();
    await lastScene.and(page.locator('.is-entering')).waitFor();
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height: 900});
      await page.goto(app + 'about.html');
      await page.evaluate(() => {
        const second = document.querySelectorAll('.about-chapter')[1];
        window.scrollTo(0, second.getBoundingClientRect().top + scrollY - 170);
      });
      await page.waitForFunction(() => {
        const [first, second] = document.querySelectorAll('.about-chapter');
        const next = second.getBoundingClientRect();
        const front = document.elementFromPoint(innerWidth / 2, next.top + 18);
        return getComputedStyle(first).position === 'sticky' &&
          Number(first.style.getPropertyValue('--paper-scale')) < 0.99 &&
          first.getBoundingClientRect().bottom > next.top &&
          front?.closest('.about-chapter') === second;
      });
      await page.screenshot({path: path.join(out, 'public-about-stack-' + width + '.png')});
    }
    assert.deepEqual(errors, []);
    console.log('Sage & Linen homepage and About, demos, invitation draft and TEST sign-in passed at 320, 390, 768 and 1440px. Scroll layering passed at 390 and 1440px.');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
