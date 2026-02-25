/**
 * SizeCompare — Brooks Content Script
 *
 * Scrapes size chart data from brooksrunning.com pages.
 * Targets: size chart pages and product pages.
 */

(function () {
  'use strict';

  const BRAND = 'Brooks';

  function parseVersion(name) {
    const match = name.match(/^(.+?)\s+(\d+)$/);
    if (match) return { family: match[1].trim(), version: match[2] };
    return { family: name, version: null };
  }

  function isSizeChartPage() {
    return (
      window.location.pathname.includes('size-chart') ||
      window.location.pathname.includes('sizing')
    );
  }

  function isProductPage() {
    return (
      document.querySelector('.pdp-details') !== null ||
      document.querySelector('[data-component="product-detail"]') !== null ||
      document.querySelector('.product-detail') !== null
    );
  }

  // ---------------------------------------------------------------------------
  // Size chart scraping
  // ---------------------------------------------------------------------------

  function scrapeSizeChart() {
    const results = [];

    // Brooks uses standard tables and sometimes Demandware-hosted static content
    const tables = document.querySelectorAll(
      '.size-chart-table table, .pdp-size-chart table, .sizing-table, table'
    );

    for (const table of tables) {
      const data = parseTable(table);
      if (data.length > 0) {
        results.push(...data);
      }
    }

    // Brooks also uses div-based grids on some pages
    if (results.length === 0) {
      const grids = document.querySelectorAll('.size-chart-grid, .size-guide-grid');
      for (const grid of grids) {
        const data = parseDivGrid(grid);
        results.push(...data);
      }
    }

    return results;
  }

  function parseTable(table) {
    const rows = table.querySelectorAll('tr');
    if (rows.length < 2) return [];

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

    if (colMap.us === undefined) return [];

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

  function parseDivGrid(grid) {
    const results = [];
    const rows = grid.querySelectorAll('.row, [class*="row"]');

    for (const row of rows) {
      const cells = row.querySelectorAll('.cell, [class*="cell"], span');
      if (cells.length >= 2) {
        const entry = {};
        if (cells[0]) entry.us = cells[0].textContent.trim();
        if (cells[1]) entry.uk = cells[1].textContent.trim();
        if (cells[2]) entry.eu = cells[2].textContent.trim();
        if (cells[3]) entry.cm = cells[3].textContent.trim();
        if (entry.us) results.push(entry);
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Product page scraping
  // ---------------------------------------------------------------------------

  function scrapeProductInfo() {
    const title =
      document.querySelector('.pdp-details h1')?.textContent ||
      document.querySelector('[data-component="product-detail"] h1')?.textContent ||
      document.querySelector('.product-detail h1')?.textContent ||
      document.querySelector('h1')?.textContent ||
      '';

    const modelName = title.replace(/Brooks\s*/i, '').trim();
    const versionInfo = parseVersion(modelName);

    return {
      brandName: BRAND,
      modelName,
      modelFamily: versionInfo.family,
      version: versionInfo.version,
      category: inferCategory(title),
    };
  }

  function inferCategory(title) {
    const lower = title.toLowerCase();
    if (lower.includes('cascadia') || lower.includes('caldera') || lower.includes('catamount')) {
      return 'trail';
    }
    return 'road';
  }

  function detectGender() {
    const url = window.location.href.toLowerCase();
    if (url.includes('women') || url.includes('/w/')) return 'womens';
    if (url.includes('men') || url.includes('/m/')) return 'mens';

    const breadcrumb = document.querySelector('.breadcrumb, nav[aria-label="breadcrumb"]');
    if (breadcrumb) {
      const text = breadcrumb.textContent.toLowerCase();
      if (text.includes('women')) return 'womens';
      if (text.includes('men')) return 'mens';
    }

    return 'mens';
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
        console.log(`[SizeCompare] Scraped ${sizeData.length} sizes from ${BRAND}`);
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

  if (document.readyState === 'complete') {
    setTimeout(run, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(run, 1000));
  }
})();
