/**
 * SizeCompare — RunRepeat Content Script
 *
 * Scrapes shoe review data from runrepeat.com for sizing information.
 * Extracts: brand, model name, sizing verdict, and any size chart data.
 */

(function () {
  'use strict';

  const SOURCE_SITE = 'runrepeat';

  function isReviewPage() {
    // RunRepeat review pages have URLs like /ranking/best-nike-running-shoes
    // or individual reviews like /review/nike-air-zoom-pegasus-40
    return (
      window.location.pathname.includes('/review/') ||
      window.location.pathname.includes('/ranking/')
    );
  }

  // ---------------------------------------------------------------------------
  // Single review page scraping
  // ---------------------------------------------------------------------------

  function scrapeReviewPage() {
    const results = [];

    // Extract the shoe name from the page title / heading
    const title =
      document.querySelector('h1')?.textContent ||
      document.querySelector('.review-title')?.textContent ||
      '';

    if (!title) return results;

    // Parse brand and model from the title
    // RunRepeat titles are like "Nike Air Zoom Pegasus 40 Review"
    const { brand, model } = parseBrandModel(title);

    // Look for sizing information in the review content
    const sizingInfo = extractSizingInfo();

    if (sizingInfo) {
      results.push({
        url: window.location.href,
        brandName: brand,
        modelName: model,
        sizingText: sizingInfo.text,
        scores: sizingInfo.scores,
      });
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Ranking/list page scraping
  // ---------------------------------------------------------------------------

  function scrapeRankingPage() {
    const results = [];

    // RunRepeat ranking pages list multiple shoes with brief sizing info
    const shoeCards = document.querySelectorAll(
      '.shoe-card, [data-component="shoe-listing"], .ranking-item, article'
    );

    for (const card of shoeCards) {
      const name = card.querySelector('h2, h3, .shoe-name, a[href*="/review/"]')?.textContent || '';
      if (!name) continue;

      const { brand, model } = parseBrandModel(name);

      // Look for sizing text within the card
      const sizingText = findSizingText(card);
      if (sizingText) {
        results.push({
          url: window.location.href,
          brandName: brand,
          modelName: model,
          sizingText: sizingText,
          scores: null,
        });
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Sizing info extraction
  // ---------------------------------------------------------------------------

  function extractSizingInfo() {
    // Strategy 1: Look for explicit sizing sections
    const sizingSections = document.querySelectorAll(
      '[class*="sizing"], [class*="fit"], [data-section="sizing"]'
    );

    for (const section of sizingSections) {
      const text = section.textContent.trim();
      if (isSizingRelated(text)) {
        return {
          text: extractRelevantSentences(text),
          scores: extractScores(section),
        };
      }
    }

    // Strategy 2: Search all review content for sizing mentions
    const reviewBody = document.querySelector(
      '.review-body, .review-content, [class*="review-text"], article'
    );

    if (reviewBody) {
      const paragraphs = reviewBody.querySelectorAll('p, li');
      for (const p of paragraphs) {
        const text = p.textContent.trim();
        if (isSizingRelated(text)) {
          return {
            text: extractRelevantSentences(text),
            scores: null,
          };
        }
      }
    }

    // Strategy 3: Look for RunRepeat's structured scoring (they often rate sizing)
    const scoreElements = document.querySelectorAll(
      '[class*="score"], [class*="rating"], [data-score]'
    );
    for (const el of scoreElements) {
      const label = el.previousElementSibling?.textContent || el.getAttribute('data-label') || '';
      if (label.toLowerCase().includes('size') || label.toLowerCase().includes('fit')) {
        return {
          text: `Sizing score: ${el.textContent.trim()}`,
          scores: { sizing: parseFloat(el.textContent) || null },
        };
      }
    }

    return null;
  }

  function extractScores(section) {
    const scores = {};
    const scoreEls = section.querySelectorAll('[class*="score"], [data-score]');
    for (const el of scoreEls) {
      const value = parseFloat(el.textContent);
      if (!isNaN(value)) {
        scores.sizing = value;
        break;
      }
    }
    return Object.keys(scores).length > 0 ? scores : null;
  }

  // ---------------------------------------------------------------------------
  // Text analysis helpers
  // ---------------------------------------------------------------------------

  const SIZING_KEYWORDS = [
    'true to size', 'runs small', 'runs large', 'runs big',
    'size up', 'size down', 'half size', 'full size',
    'narrow', 'wide', 'tight', 'loose', 'snug', 'roomy',
    'fit', 'sizing', 'fits true', 'order up', 'order down',
  ];

  function isSizingRelated(text) {
    const lower = text.toLowerCase();
    return SIZING_KEYWORDS.some((keyword) => lower.includes(keyword));
  }

  function extractRelevantSentences(text) {
    const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
    const relevant = sentences.filter((s) => isSizingRelated(s));
    return relevant.join('. ') || text.substring(0, 200);
  }

  function findSizingText(element) {
    const allText = element.textContent;
    if (!isSizingRelated(allText)) return null;
    return extractRelevantSentences(allText);
  }

  // ---------------------------------------------------------------------------
  // Brand/model parser
  // ---------------------------------------------------------------------------

  const KNOWN_BRANDS = ['Nike', 'Brooks', 'Saucony', 'Asics', 'ASICS', 'Adidas', 'adidas',
    'New Balance', 'HOKA', 'Hoka', 'On', 'Under Armour', 'Puma', 'PUMA',
    'Mizuno', 'Altra', 'Salomon', 'Merrell'];

  function parseBrandModel(title) {
    const cleaned = title
      .replace(/\s+review$/i, '')
      .replace(/\s+\d{4}$/i, '') // Remove year
      .trim();

    for (const brand of KNOWN_BRANDS) {
      if (cleaned.toLowerCase().startsWith(brand.toLowerCase())) {
        return {
          brand: brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase(),
          model: cleaned.substring(brand.length).trim(),
        };
      }
    }

    // Fallback: first word is brand, rest is model
    const parts = cleaned.split(/\s+/);
    return {
      brand: parts[0] || '',
      model: parts.slice(1).join(' ') || cleaned,
    };
  }

  // ---------------------------------------------------------------------------
  // Main execution
  // ---------------------------------------------------------------------------

  function run() {
    if (!isReviewPage()) return;

    let scrapedItems = [];

    if (window.location.pathname.includes('/review/')) {
      scrapedItems = scrapeReviewPage();
    } else if (window.location.pathname.includes('/ranking/')) {
      scrapedItems = scrapeRankingPage();
    }

    for (const item of scrapedItems) {
      chrome.runtime.sendMessage({
        type: 'SCRAPE_FIT_DATA',
        ...item,
        sourceSite: SOURCE_SITE,
      });
    }

    if (scrapedItems.length > 0) {
      console.log(`[SizeCompare] Scraped ${scrapedItems.length} sizing entries from RunRepeat`);
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(run, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(run, 1500));
  }
})();
