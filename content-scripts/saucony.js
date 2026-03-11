/**
 * FitShift — Saucony Content Script
 *
 * Scrapes size chart data from saucony.com pages.
 */

(function () {
  'use strict';

  const BRAND = 'Saucony';

  function parseVersion(name) {
    const match = name.match(/^(.+?)\s+(\d+)$/);
    if (match) return { family: match[1].trim(), version: match[2] };
    return { family: name, version: null };
  }

  function isSizeChartPage() {
    return (
      window.location.pathname.includes('sizing-guide') ||
      window.location.pathname.includes('size-chart') ||
      window.location.pathname.includes('size-guide')
    );
  }

  function isProductPage() {
    return (
      document.querySelector('.product-detail') !== null ||
      document.querySelector('[data-product-component]') !== null ||
      document.querySelector('.pdp-main') !== null
    );
  }

  function scrapeSizeChart() {
    const results = [];

    // Saucony uses standard HTML tables on their sizing guide page
    const tables = document.querySelectorAll(
      '.sizing-guide table, .size-chart table, table'
    );

    for (const table of tables) {
      const rows = table.querySelectorAll('tr');
      if (rows.length < 2) continue;

      const headerCells = rows[0].querySelectorAll('th, td');
      const headers = Array.from(headerCells).map((c) => c.textContent.trim().toLowerCase());

      const colMap = {};
      headers.forEach((h, i) => {
        if (h.includes('us') && !h.includes('uk')) colMap.us = i;
        else if (h.includes('uk')) colMap.uk = i;
        else if (h.includes('eu') || h.includes('eur')) colMap.eu = i;
        else if (h.includes('cm') || h.includes('foot') || h.includes('length')) colMap.cm = i;
      });

      if (colMap.us === undefined) continue;

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
    }

    // Saucony also uses tab-based size chart modals on product pages
    if (results.length === 0) {
      const modal = document.querySelector(
        '.size-chart-modal, [data-component="size-chart"], .size-guide-content'
      );
      if (modal) {
        const rows = modal.querySelectorAll('[class*="row"], tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('[class*="cell"], td, span');
          if (cells.length >= 2) {
            const entry = {};
            if (cells[0]) entry.us = cells[0].textContent.trim();
            if (cells[1]) entry.uk = cells[1].textContent.trim();
            if (cells[2]) entry.eu = cells[2].textContent.trim();
            if (cells[3]) entry.cm = cells[3].textContent.trim();
            if (entry.us) results.push(entry);
          }
        }
      }
    }

    return results;
  }

  function scrapeProductInfo() {
    const title =
      document.querySelector('.product-detail h1')?.textContent ||
      document.querySelector('.pdp-main h1')?.textContent ||
      document.querySelector('h1')?.textContent ||
      '';

    const modelName = title.replace(/Saucony\s*/i, '').trim();
    const versionInfo = parseVersion(modelName);

    return {
      brandName: BRAND,
      modelName,
      modelFamily: versionInfo.family,
      version: versionInfo.version,
      category: title.toLowerCase().includes('peregrine') || title.toLowerCase().includes('xodus')
        ? 'trail'
        : 'road',
    };
  }

  function detectGender() {
    const url = window.location.href.toLowerCase();
    if (url.includes('women') || url.includes('/w/')) return 'womens';
    if (url.includes('men') || url.includes('/m/')) return 'mens';
    return 'mens';
  }

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
        console.log(`[FitShift] Scraped ${sizeData.length} sizes from ${BRAND}`);
      }
    }

    if (isProductPage()) {
      const productInfo = scrapeProductInfo();
      if (productInfo.modelName) {
        chrome.runtime.sendMessage({ type: 'SCRAPE_MODEL', ...productInfo });
        console.log(`[FitShift] Found ${BRAND} product: ${productInfo.modelName}`);
      }
    }
  }

  if (document.readyState === 'complete') {
    setTimeout(run, 1000);
  } else {
    window.addEventListener('load', () => setTimeout(run, 1000));
  }
})();
