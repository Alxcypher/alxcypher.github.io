/**
 * SizeCompare — Nike Content Script
 *
 * Scrapes size chart data from nike.com pages.
 * Targets: /size-fit-guide pages and product page size selectors.
 */

(function () {
  'use strict';

  const BRAND = 'Nike';

  // Detect if we're on a size chart / size guide page
  function isSizeChartPage() {
    return (
      window.location.pathname.includes('size-fit-guide') ||
      window.location.pathname.includes('size-chart')
    );
  }

  // Detect if we're on a product page
  function isProductPage() {
    return (
      document.querySelector('[data-testid="product-title"]') !== null ||
      document.querySelector('.product-info__title') !== null
    );
  }

  // ---------------------------------------------------------------------------
  // Size chart scraping
  // ---------------------------------------------------------------------------

  function scrapeSizeChart() {
    const results = [];

    // Strategy 1: Look for standard HTML tables
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const data = parseTable(table);
      if (data.length > 0) {
        results.push(...data);
      }
    }

    // Strategy 2: Look for Nike's custom size grid components
    if (results.length === 0) {
      const grids = document.querySelectorAll(
        '[data-testid="size-grid"], .size-grid, .size-chart-grid'
      );
      for (const grid of grids) {
        const data = parseSizeGrid(grid);
        if (data.length > 0) {
          results.push(...data);
        }
      }
    }

    // Strategy 3: Look for structured data in JSON-LD or data attributes
    if (results.length === 0) {
      const jsonLd = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of jsonLd) {
        try {
          const data = JSON.parse(script.textContent);
          if (data.size || data.offers) {
            // Extract size info from structured data
            const sizes = extractFromStructuredData(data);
            results.push(...sizes);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

    return results;
  }

  function parseTable(table) {
    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) return [];

    // Find header row to identify column mapping
    const headerCells = rows[0].querySelectorAll('th, td');
    const headers = Array.from(headerCells).map((cell) =>
      cell.textContent.trim().toLowerCase()
    );

    const colMap = {};
    headers.forEach((h, i) => {
      if (h.includes('us') && !h.includes('uk')) colMap.us = i;
      else if (h.includes('uk')) colMap.uk = i;
      else if (h.includes('eu') || h.includes('eur')) colMap.eu = i;
      else if (h.includes('cm') || h.includes('foot') || h.includes('length')) colMap.cm = i;
    });

    if (!colMap.us && colMap.us !== 0) return [];

    const results = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length === 0) continue;

      const entry = {};
      if (colMap.us !== undefined) entry.us = cells[colMap.us]?.textContent.trim();
      if (colMap.uk !== undefined) entry.uk = cells[colMap.uk]?.textContent.trim();
      if (colMap.eu !== undefined) entry.eu = cells[colMap.eu]?.textContent.trim();
      if (colMap.cm !== undefined) entry.cm = cells[colMap.cm]?.textContent.trim();

      if (entry.us) results.push(entry);
    }

    return results;
  }

  function parseSizeGrid(grid) {
    const results = [];
    const rows = grid.querySelectorAll('[role="row"], .grid-row, tr');

    for (const row of rows) {
      const cells = row.querySelectorAll('[role="cell"], .grid-cell, td');
      if (cells.length >= 2) {
        const entry = {};
        // Nike grids typically: US | UK | EU | cm
        if (cells[0]) entry.us = cells[0].textContent.trim();
        if (cells[1]) entry.uk = cells[1].textContent.trim();
        if (cells[2]) entry.eu = cells[2].textContent.trim();
        if (cells[3]) entry.cm = cells[3].textContent.trim();
        if (entry.us) results.push(entry);
      }
    }

    return results;
  }

  function extractFromStructuredData(data) {
    // Handle various structured data formats
    const results = [];
    if (Array.isArray(data.offers)) {
      for (const offer of data.offers) {
        if (offer.size) {
          results.push({ us: offer.size });
        }
      }
    }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Product page scraping — extract model name
  // ---------------------------------------------------------------------------

  function scrapeProductInfo() {
    const title =
      document.querySelector('[data-testid="product-title"]')?.textContent ||
      document.querySelector('.product-info__title')?.textContent ||
      document.querySelector('h1')?.textContent ||
      '';

    const subtitle =
      document.querySelector('[data-testid="product-subtitle"]')?.textContent ||
      document.querySelector('.product-info__subtitle')?.textContent ||
      '';

    return {
      brandName: BRAND,
      modelName: title.trim(),
      category: subtitle.toLowerCase().includes('trail') ? 'trail' : 'road',
    };
  }

  // ---------------------------------------------------------------------------
  // Detect gender from page context
  // ---------------------------------------------------------------------------

  function detectGender() {
    const url = window.location.href.toLowerCase();
    const pageText = document.body?.textContent?.toLowerCase() || '';

    if (url.includes('women') || url.includes('female')) return 'womens';
    if (url.includes('men') || url.includes('male')) return 'mens';

    // Check page content
    const heading = document.querySelector('h1, h2')?.textContent?.toLowerCase() || '';
    if (heading.includes('women')) return 'womens';
    if (heading.includes('men')) return 'mens';

    return 'mens'; // Default
  }

  // ---------------------------------------------------------------------------
  // Main execution
  // ---------------------------------------------------------------------------

  function run() {
    if (isSizeChartPage()) {
      const sizeData = scrapeSizeChart();
      if (sizeData.length > 0) {
        chrome.runtime.sendMessage({
          type: 'SCRAPE_SIZE_CHART',
          brandName: BRAND,
          gender: detectGender(),
          data: sizeData,
        });
        console.log(`[SizeCompare] Scraped ${sizeData.length} sizes from ${BRAND} size chart`);
      }
    }

    if (isProductPage()) {
      const productInfo = scrapeProductInfo();
      if (productInfo.modelName) {
        chrome.runtime.sendMessage({
          type: 'SCRAPE_MODEL',
          ...productInfo,
        });
        console.log(`[SizeCompare] Found ${BRAND} product: ${productInfo.modelName}`);
      }
    }
  }

  // Run after a short delay to let dynamic content load
  if (document.readyState === 'complete') {
    setTimeout(run, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(run, 1000));
  }

  // Also watch for SPA navigation (Nike uses client-side routing)
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(run, 2000);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
