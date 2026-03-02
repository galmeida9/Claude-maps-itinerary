/**
 * scrape-gmaps-list.mjs
 * Scrapes all places from a Google Maps saved list URL.
 *
 * Usage: node scrape-gmaps-list.mjs <url> <output.json>
 */

import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const [,, url, outputPath] = process.argv;

if (!url || !outputPath) {
  console.error('Usage: node scrape-gmaps-list.mjs <url> <output.json>');
  process.exit(1);
}

async function handleConsentPage(page) {
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = (await btn.textContent() || '').toLowerCase().trim();
    if (
      text.includes('accept') || text.includes('agree') ||
      text.includes('godta') || text.includes('accepter') ||
      text.includes('ich stimme') || text.includes('acepto') ||
      text.includes('tout accepter') || text.includes('alle akzeptieren')
    ) {
      await btn.click();
      await page.waitForTimeout(3000);
      return;
    }
  }
}

async function scrollPanelToLoadAll(page) {
  const panelSelectors = ['.m6QErb.DxyBCb', '.m6QErb'];
  let sel = null;

  for (const s of panelSelectors) {
    if (await page.$(s)) { sel = s; break; }
  }

  if (!sel) {
    // Fallback: scroll the window
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(400);
    }
    return;
  }

  let lastCount = 0;
  let noChangeRounds = 0;

  for (let i = 0; i < 80; i++) {
    const currentCount = await page.evaluate(() =>
      document.querySelectorAll('.fontHeadlineSmall.rZF81c').length
    );

    await page.evaluate((s) => {
      const panels = document.querySelectorAll(s);
      for (const panel of panels) {
        const overflow = window.getComputedStyle(panel).overflowY;
        if (overflow === 'auto' || overflow === 'scroll' || panel.scrollHeight > panel.clientHeight + 10) {
          panel.scrollTop += 1500;
          return;
        }
      }
      const el = document.querySelector(s);
      if (el) el.scrollTop += 1500;
    }, sel);

    await page.waitForTimeout(600);

    if (currentCount === lastCount) {
      noChangeRounds++;
      if (noChangeRounds >= 6) {
        process.stderr.write(`Finished scrolling at ${currentCount} items.\n`);
        break;
      }
    } else {
      process.stderr.write(`Loaded ${currentCount} items...\n`);
      noChangeRounds = 0;
    }
    lastCount = currentCount;
  }
}

async function extractPlaces(page) {
  return await page.evaluate(() => {
    const results = [];
    const nameEls = document.querySelectorAll('.fontHeadlineSmall.rZF81c');

    nameEls.forEach(nameEl => {
      const name = nameEl.textContent?.trim();
      if (!name) return;

      const cardContent = nameEl.closest('.H1bDYe') || nameEl.parentElement;

      const ratingEl = cardContent?.querySelector('.MW4etd');
      const rating = ratingEl?.textContent?.trim() || '';

      const reviewCountEl = cardContent?.querySelector('.UY7F9');
      const reviewCount = reviewCountEl?.textContent?.trim().replace(/[()]/g, '') || '';

      const iirLbbEls = cardContent?.querySelectorAll('.IIrLbb') || [];
      let category = '';
      let priceLevel = '';

      iirLbbEls.forEach((el, idx) => {
        if (idx === 0) return;
        el.querySelectorAll('span').forEach(span => {
          const ariaLabel = span.getAttribute('aria-label') || '';
          const text = span.textContent?.trim() || '';
          if (ariaLabel.toLowerCase().includes('price') || /^\$+$/.test(text)) {
            priceLevel = text || ariaLabel;
          } else if (text && text !== '·' && !text.startsWith('$')) {
            category = text.replace(/^[·•\s]+/, '').trim();
          }
        });
      });

      // User-added notes
      const noteEl = cardContent?.closest('.ZSOIif')?.querySelector('.Io6YTe') ||
                     nameEl.closest('button')?.querySelector('.Io6YTe') ||
                     nameEl.parentElement?.parentElement?.querySelector('.Io6YTe');
      const note = noteEl?.textContent?.trim() || '';

      const place = { name };
      if (category) place.category = category;
      if (priceLevel) place.priceLevel = priceLevel;
      if (rating) place.rating = rating;
      if (reviewCount) place.reviewCount = reviewCount;
      if (note) place.note = note;
      results.push(place);
    });

    return results;
  });
}

async function main() {
  process.stderr.write(`Scraping: ${url}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 20,
    args: ['--lang=en-US', '--window-size=1280,900'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    process.stderr.write(`Navigation note: ${e.message.slice(0, 80)}\n`);
  }

  await page.waitForTimeout(2000);

  if (page.url().includes('consent.google.com')) {
    await handleConsentPage(page);
  }

  try {
    await page.waitForSelector('.fontHeadlineSmall.rZF81c', { timeout: 15000 });
  } catch {
    process.stderr.write('Warning: place items not visible within 15s — page may not have loaded correctly.\n');
  }

  await page.waitForTimeout(1500);
  await scrollPanelToLoadAll(page);
  await page.waitForTimeout(1000);

  const places = await extractPlaces(page);
  await browser.close();

  const out = resolve(outputPath);
  writeFileSync(out, JSON.stringify(places, null, 2), 'utf8');
  process.stderr.write(`Saved ${places.length} places to ${out}\n`);

  // Output JSON to stdout for piping
  console.log(JSON.stringify(places, null, 2));
}

main().catch(err => {
  process.stderr.write(`Fatal error: ${err.message}\n`);
  process.exit(1);
});
