import puppeteer from 'puppeteer-core';
import { mkdir } from 'node:fs/promises';

const base = process.env.APP_URL ?? 'http://127.0.0.1:5173';
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const out = '/tmp/near-easy-shots';
await mkdir(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});
const page = await browser.newPage();
const failures = [];
function check(name, ok, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`;
  console.log(line);
  if (!ok) failures.push(line);
}

async function clickText(text) {
  const clicked = await page.evaluate((value) => {
    const nodes = [...document.querySelectorAll('button, a, [role="radio"]')];
    const node = nodes.find((item) => item.textContent.replace(/\s+/g, ' ').trim() === value)
      ?? nodes.find((item) => item.textContent.replace(/\s+/g, ' ').includes(value));
    if (!(node instanceof HTMLElement)) return false;
    node.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`Missing control: ${text}`);
}

async function overflow() {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
}

const routes = [
  ['/', 'home'],
  ['/assistant', 'assistant'],
  ['/wallet', 'wallet'],
  ['/funding', 'funding'],
  ['/staking', 'staking'],
  ['/explore', 'explore'],
  ['/roadmap', 'roadmap'],
  ['/activity', 'activity'],
  ['/settings', 'settings'],
];

try {
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(base, ['clipboard-read', 'clipboard-write']);

  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    for (const [route, name] of routes) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1');
      const h1 = await page.$('h1');
      check(`${width} ${name} has h1`, Boolean(h1));
      const wide = await overflow();
      check(`${width} ${name} no horizontal scroll`, !wide);
      await page.screenshot({ path: `${out}/${width}-${name}.png`, fullPage: true });
    }
  }

  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  const status = await page.$eval('#wallet-status', (node) => node.textContent.trim());
  check('wallet starts disconnected', status === 'Not connected', status);
  await page.$eval('.user-chip', (node) => node.click());
  await page.waitForSelector('[role="dialog"]');
  const dialogInfo = await page.$eval('[role="dialog"]', (node) => ({
    text: node.innerText,
    inputs: node.querySelectorAll('input, textarea').length,
  }));
  check('connect dialog does not claim a connection', !/\bConnected\b/.test(dialogInfo.text) && /nothing is connected/i.test(dialogInfo.text), dialogInfo.text.replace(/\s+/g, ' '));
  check('connect dialog refuses a seed phrase', /will not ask for your seed phrase or private key/i.test(dialogInfo.text) && dialogInfo.inputs === 0);
  await page.$eval('#choose-wallet', (node) => node.click());
  await page.waitForSelector('.hot-connector-popup', { timeout: 20000 });
  const picker = await page.$eval('.hot-connector-popup', (node) => node.innerText);
  check('wallet list includes HOT Wallet', /HOT Wallet/.test(picker), picker.replace(/\s+/g, ' ').slice(0, 240));
  check('wallet list includes Meteor Wallet', /Meteor Wallet/.test(picker));
  check('wallet list includes MyNearWallet', /MyNearWallet/.test(picker));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.body.innerText.includes('The wallet request was declined'), { timeout: 8000 });
  const afterDecline = await page.$eval('[role="dialog"]', (node) => node.innerText);
  check('declined connection stays disconnected', /declined/.test(afterDecline) && !/\bConnected\b/.test(afterDecline));
  await page.$eval('[aria-label="Close dialog"]', (node) => node.click());

  await clickText('View sample layout');
  await page.waitForSelector('.sample-banner');
  const sampleStatus = await page.$eval('#wallet-status', (node) => node.textContent.trim());
  check('sample layout is labelled', sampleStatus === 'Sample layout', sampleStatus);
  check('sample banner visible', (await page.$eval('.sample-banner', (node) => node.innerText)).includes('not your balances'));

  await clickText('Use $100 from Solana to stake NEAR.');
  await page.waitForSelector('#funding-handoff', { timeout: 8000 });
  const handoff = await page.$eval('#funding-handoff', (node) => ({
    text: node.innerText,
    href: node.querySelector('a')?.getAttribute('href') ?? '',
  }));
  check('assistant prepares 100 USDC on Solana devnet', /100/.test(handoff.text) && /USDC/.test(handoff.text) && /Solana devnet/.test(handoff.text), handoff.text.replace(/\s+/g, ' '));
  check('assistant does not invent a received amount', !/you will receive \d/i.test(handoff.text) && /Nothing was sent/.test(handoff.text));
  check('assistant links to the testnet quote', /\/funding\?/.test(handoff.href) && /amount=100/.test(handoff.href) && /chain=sol/.test(handoff.href), handoff.href);
  check('assistant keeps staking separate', /does not stake/.test(handoff.text));

  await page.goto(base + '/explore', { waitUntil: 'domcontentloaded' });
  await page.type('#explore-search', 'rhea');
  const exploreText = await page.$eval('.app-grid', (node) => node.innerText);
  check('search finds Rhea', /Rhea Finance/.test(exploreText));
  check('search hides other apps', !/Meteor/.test(exploreText));
  await clickText('Gaming');
  await page.waitForFunction(() => document.body.innerText.includes('No gaming apps'));
  check('empty gaming category', true);

  await page.goto(base + '/roadmap?status=soon', { waitUntil: 'domcontentloaded' });
  const roadmap = await page.evaluate(() => document.body.innerText);
  check('soon filter hides staking priority label mix', /Coming Soon/.test(roadmap) && /Token swap/.test(roadmap));
  check('roadmap does not mark execution live', !/Live \(/.test(roadmap));

  await page.goto(base + '/funding?chain=sol&token=USDC&amount=10', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#funding-amount');
  await page.waitForFunction(() => {
    const input = document.querySelector('#funding-amount');
    return input instanceof HTMLInputElement && input.value === '10' && document.body.innerText.includes('Solana devnet');
  }, { timeout: 20000 });
  check('solana funding query fills 10', true);
  const solWallet = await page.$eval('#origin-wallet', (node) => node.textContent ?? '');
  check('solana wallet section stays on devnet', /Phantom/.test(solWallet) && /Solana devnet/.test(solWallet) && /does not ask for a seed phrase/.test(solWallet) && !/Transfer succeeded|mainnet-beta/.test(solWallet), solWallet.replace(/\s+/g, ' ').slice(0, 240));

  await page.goto(base + '/funding', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelectorAll('[role="radio"]')].some((node) => node.textContent.includes('Base Sepolia')), { timeout: 20000 });
  await clickText('Base Sepolia');
  await page.waitForFunction(() => /chain id 84532/.test(document.querySelector('#origin-wallet')?.textContent ?? ''));
  const baseWallet = await page.$eval('#origin-wallet', (node) => node.textContent ?? '');
  check('base wallet section is sepolia only', /Base Sepolia/.test(baseWallet) && /84532/.test(baseWallet) && /Mainnet chains are refused/.test(baseWallet), baseWallet.replace(/\s+/g, ' ').slice(0, 240));
  await page.type('#funding-amount', '25');
  await page.type('#funding-destination', 'alice.testnet');
  await page.type('#funding-refund', '0x1111111111111111111111111111111111111111');
  await clickText('Get testnet quote');
  await page.waitForFunction(() => /Expected output|could not quote|Tidepool rejected|Tidepool could not/.test(document.body.innerText), { timeout: 25000 });
  const fundingText = await page.evaluate(() => document.body.innerText);
  check('funding quote uses Base and 25', /Base Sepolia/.test(fundingText) && /25/.test(fundingText), fundingText.replace(/\s+/g, ' ').slice(0, 400));
  check('funding names Tidepool and stays on testnet', /Tidepool/.test(fundingText) && /not affiliated with NEAR/i.test(fundingText));
  check('funding does not claim a completed transfer', !/Funding complete|Transfer succeeded|swap succeeded/i.test(fundingText));
  check('funding does not treat wrapped NEAR as stakeable', /not assumed to be native, stakeable NEAR|does not unwrap or stake/i.test(fundingText));
  await page.setViewport({ width: 375, height: 800 });
  check('funding quote has no horizontal scroll on a phone', !(await overflow()));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.click('input[type="checkbox"]');
  await clickText('Prepare deposit');
  await page.waitForFunction(() => /Deposit is not sent yet|did not return a deposit|could not quote|Tidepool rejected|Tidepool could not/.test(document.body.innerText), { timeout: 25000 });
  const prepared = await page.evaluate(() => document.body.innerText);
  check('prepared deposit does not claim success', !/Tidepool reported SUCCESS|Funding complete|Transfer succeeded/.test(prepared));
  if (/Deposit is not sent yet/.test(prepared)) {
    check('prepared base deposit asks for wallet approval', /84532/.test(prepared) && /Base Sepolia wallet|Approve test transfer/.test(prepared), prepared.replace(/\s+/g, ' ').slice(0, 300));
    await page.setViewport({ width: 375, height: 800 });
    check('deposit step has no horizontal scroll on a phone', !(await overflow()));
    await page.setViewport({ width: 1440, height: 1000 });
  } else {
    check('prepared base deposit asks for wallet approval', false, prepared.replace(/\s+/g, ' ').slice(0, 300));
  }

  await page.goto(base + '/staking', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const select = document.querySelector('#stake-validator');
    return select instanceof HTMLSelectElement && select.value !== '' && document.body.innerText.includes(select.value);
  }, { timeout: 30000 });
  const firstPool = await page.$eval('#stake-validator', (node) => node.value);
  await page.select('#stake-validator', firstPool);
  const validatorCard = await page.evaluate(() => document.body.innerText);
  check('validator selection shows the pool and a commission', validatorCard.includes(firstPool) && /\d+(?:\.\d+)?%/.test(validatorCard), firstPool);
  check('mainnet staking stays off', /Mainnet staking stays off/.test(validatorCard));
  await page.type('#stake-amount', '0');
  await clickText('Review stake');
  check('stake form rejects zero', /greater than zero/.test(await page.evaluate(() => document.body.innerText)));
  await page.click('#stake-amount', { clickCount: 3 });
  await page.type('#stake-amount', '1');
  await clickText('Review stake');
  check('stake without a wallet is blocked', /sample layout is not a wallet|Connect a wallet/.test(await page.evaluate(() => document.body.innerText)));
  await page.setViewport({ width: 375, height: 800 });
  check('staking form has no horizontal scroll on a phone', !(await overflow()));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(base + '/staking?amount=5', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#stake-amount');
  const filled = await page.$eval('#stake-amount', (node) => node.value);
  check('stake amount query fills the field', filled === '5', filled);

  await page.goto(base + '/activity', { waitUntil: 'domcontentloaded' });
  await clickText('Status examples');
  await clickText('Failed');
  const activity = await page.evaluate(() => document.body.innerText);
  check('failed example filter', /Failed example/.test(activity) && !/Pending example/.test(activity));
  check('no fake explorer hash', !/nearblocks\.io\/tx\//.test(activity));

  await page.goto(base + '/settings', { waitUntil: 'domcontentloaded' });
  await clickText('Advanced');
  await page.goto(base + '/assistant', { waitUntil: 'domcontentloaded' });
  const advancedOn = await page.$eval('.mode-switch .on', (node) => node.textContent.trim());
  check('mode persists', advancedOn === 'Advanced', advancedOn);

  await page.waitForFunction(() => /API key|Checking the assistant|Live answers are on/.test(document.body.innerText), { timeout: 8000 });
  await page.type('#chat-input', 'What is my NEAR balance?');
  await page.click('.chat-command .command-go');
  await page.waitForFunction(() => {
    const row = document.querySelector('.bubble-row.assistant .speech');
    if (!row) return false;
    const alert = row.querySelector('[role="alert"]');
    const live = row.textContent.includes('Live model');
    return Boolean(alert || live) && !row.querySelector('.loading-line');
  }, { timeout: 70000 });
  const balanceReply = await page.$eval('.bubble-row.assistant .speech', (node) => node.innerText);
  check('wallet question gets a reply or a clear error', /API key|not configured|could not|unknown|connect/i.test(balanceReply), balanceReply.replace(/\s+/g, ' ').slice(0, 240));
  check('wallet question does not invent a balance', !/123\.46|71\.46|40\.00|12\.00/.test(balanceReply), balanceReply.replace(/\s+/g, ' ').slice(0, 240));

  await page.type('#chat-input', 'Stake 5 NEAR');
  await page.click('.chat-command .command-go');
  await page.waitForSelector('a[href="/staking?amount=5"]', { timeout: 8000 });
  check('stake instruction opens the staking amount', true);
  await page.click('a[href="/staking?amount=5"]');
  await page.waitForSelector('#stake-amount');
  const fromAssistant = await page.$eval('#stake-amount', (node) => node.value);
  check('assistant fills 5 NEAR', fromAssistant === '5', fromAssistant);
  await page.goto(base + '/assistant', { waitUntil: 'domcontentloaded' });
  await page.type('#chat-input', 'What is staking on NEAR?');
  await page.click('.chat-command .command-go');
  await page.waitForFunction(() => document.querySelectorAll('.bubble-row.user').length >= 1, { timeout: 8000 });
  await page.waitForFunction(() => {
    const row = [...document.querySelectorAll('.bubble-row.assistant .speech')].at(-1);
    return Boolean(row && !row.querySelector('.loading-line'));
  }, { timeout: 70000 });
  const turns = await page.$$eval('.bubble-row .speech', (nodes) => nodes.map((node) => node.innerText));
  check('conversation keeps the staking question', turns.some((text) => /staking on NEAR/.test(text)));
  const stakingReply = turns.filter((text) => text.startsWith('Assistant')).at(-1) || '';
  check('staking question does not invent a reward', !/\bAPY\b|you will earn|12%/i.test(stakingReply), stakingReply.replace(/\s+/g, ' ').slice(0, 240));

  await page.setViewport({ width: 375, height: 800 });
  check('assistant thread has no horizontal scroll on a phone', !(await overflow()));
  await page.setViewport({ width: 1440, height: 1000 });

  await page.$eval('[aria-label="Notifications"]', (node) => node.click());
  await page.waitForSelector('[role="menu"]');
  check('notification menu opens', true);
  await page.keyboard.press('Escape');

  await page.setViewport({ width: 375, height: 800 });
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  check('mobile menu button exists', Boolean(await page.$('.tabbar')));
  await clickText('More');
  await page.waitForSelector('text/Funding');
  check('mobile more menu opens', true);
} catch (error) {
  console.error(error);
  failures.push(String(error));
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
