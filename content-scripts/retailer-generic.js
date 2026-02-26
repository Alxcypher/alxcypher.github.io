/**
 * FitShift — Generic Retailer Content Script
 *
 * Detects running shoe products on any non-brand website (retailers like
 * Amazon, Zappos, REI, Running Warehouse, etc.) using structured data,
 * meta tags, and DOM heuristics.
 *
 * Excluded from brand sites via manifest exclude_matches — brand-specific
 * scripts handle those with more precise selectors.
 */

(function () {
  'use strict';

  const KNOWN_BRANDS = [
    'Nike', 'Brooks', 'Saucony', 'Asics', 'ASICS', 'Adidas', 'adidas',
    'HOKA', 'Hoka', 'On Running', 'On', 'Under Armour', 'New Balance',
    'Puma', 'PUMA', 'Mizuno', 'Altra', 'Salomon', 'Merrell',
  ];

  const SHOE_KEYWORDS = [
    'running shoe', 'running shoes', 'trail shoe', 'trail shoes',
    'road shoe', 'road shoes', 'racing shoe', 'racing flat',
    'marathon shoe', 'trainer', 'racer',
  ];

  // Brand name normalization map
  const BRAND_NORMALIZE = {
    nike: 'Nike', brooks: 'Brooks', saucony: 'Saucony',
    asics: 'Asics', adidas: 'Adidas', hoka: 'HOKA',
    'on running': 'On Running', 'on': 'On Running',
    'under armour': 'Under Armour', 'new balance': 'New Balance',
    puma: 'Puma', mizuno: 'Mizuno', altra: 'Altra',
    salomon: 'Salomon', merrell: 'Merrell',
  };

  function parseVersion(name) {
    if (!name) return { family: name, version: null };
    const match = name.trim().match(/^(.+?)\s+(\d+)$/);
    if (match) return { family: match[1].trim(), version: match[2] };
    return { family: name.trim(), version: null };
  }

  // -------------------------------------------------------------------------
  // Strategy 1: JSON-LD structured data (highest confidence)
  // -------------------------------------------------------------------------

  function detectFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        let data = JSON.parse(script.textContent);
        // Handle @graph arrays
        if (data['@graph']) data = data['@graph'];
        const items = Array.isArray(data) ? data : [data];

        for (const item of items) {
          if (item['@type'] === 'Product' || item['@type'] === 'IndividualProduct') {
            const name = item.name || '';
            const brand = item.brand?.name || item.brand || '';
            const category = item.category || '';
            const description = item.description || '';

            const detectedBrand = identifyBrand(name) || identifyBrand(brand);
            if (detectedBrand && isRunningShoe(name, category, description)) {
              const modelName = extractModelName(name, detectedBrand);
              const versionInfo = parseVersion(modelName);
              return {
                brandName: detectedBrand,
                modelName: modelName,
                modelFamily: versionInfo.family,
                version: versionInfo.version,
                category: isTrailShoe(name, category, description) ? 'trail' : 'road',
                confidence: 'high',
                source: 'json-ld',
              };
            }
          }
        }
      } catch (e) {
        // Invalid JSON — skip
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Strategy 2: Open Graph meta tags (medium confidence)
  // -------------------------------------------------------------------------

  function detectFromOpenGraph() {
    const ogType = document.querySelector('meta[property="og:type"]')?.content || '';
    if (!ogType.includes('product')) return null;

    const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
    const ogDescription = document.querySelector('meta[property="og:description"]')?.content || '';

    const detectedBrand = identifyBrand(ogTitle);
    if (detectedBrand && isRunningShoe(ogTitle, '', ogDescription)) {
      const modelName = extractModelName(ogTitle, detectedBrand);
      const versionInfo = parseVersion(modelName);
      return {
        brandName: detectedBrand,
        modelName: modelName,
        modelFamily: versionInfo.family,
        version: versionInfo.version,
        category: isTrailShoe(ogTitle, '', ogDescription) ? 'trail' : 'road',
        confidence: 'medium',
        source: 'og-meta',
      };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Strategy 3: DOM heuristics (lower confidence)
  // -------------------------------------------------------------------------

  function detectFromDOM() {
    // Check page title and h1
    const h1 = document.querySelector('h1')?.textContent?.trim() || '';
    const pageTitle = document.title || '';

    // Check URL for product indicators
    const path = window.location.pathname.toLowerCase();
    const isProductUrl = /\/(product|p|dp|ip|item|shop)\//.test(path);

    // Only try DOM heuristics if we're likely on a product page
    if (!isProductUrl && !h1) return null;

    const candidates = [h1, pageTitle];
    for (const text of candidates) {
      if (!text) continue;
      const detectedBrand = identifyBrand(text);
      if (detectedBrand) {
        const modelName = extractModelName(text, detectedBrand);
        if (modelName && modelName.length > 2 && modelName.length < 80) {
          const versionInfo = parseVersion(modelName);
          return {
            brandName: detectedBrand,
            modelName: modelName,
            modelFamily: versionInfo.family,
            version: versionInfo.version,
            category: isTrailShoe(text, '', '') ? 'trail' : 'road',
            confidence: 'low',
            source: 'dom',
          };
        }
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Helper functions
  // -------------------------------------------------------------------------

  function identifyBrand(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    for (const brand of KNOWN_BRANDS) {
      if (lower.includes(brand.toLowerCase())) {
        return BRAND_NORMALIZE[brand.toLowerCase()] || brand;
      }
    }
    return null;
  }

  function extractModelName(text, brand) {
    if (!text || !brand) return text;
    // Remove brand name, common suffixes, and clean up
    let cleaned = text;

    // Remove brand prefix (case-insensitive)
    const brandRegex = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i');
    cleaned = cleaned.replace(brandRegex, '');

    // Remove common suffixes
    cleaned = cleaned
      .replace(/\s*[-–—|]\s*.*$/, '') // Everything after a dash/pipe (usually site name)
      .replace(/\s*(men'?s?|women'?s?|unisex)\s*/gi, ' ')
      .replace(/\s*running\s+shoes?\s*/gi, ' ')
      .replace(/\s*trail\s+shoes?\s*/gi, ' ')
      .replace(/\s*road\s+shoes?\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned || text.trim();
  }

  function isRunningShoe(name, category, description) {
    const combined = `${name} ${category} ${description}`.toLowerCase();
    // Check for shoe keywords
    if (SHOE_KEYWORDS.some((kw) => combined.includes(kw))) return true;
    // If a known running brand is mentioned, assume it's a running shoe
    // (most brand-specific pages on retailers are for running shoes)
    if (combined.includes('shoe') || combined.includes('footwear')) return true;
    // Check category
    if (combined.includes('running') || combined.includes('athletic')) return true;
    return false;
  }

  function isTrailShoe(name, category, description) {
    const combined = `${name} ${category} ${description}`.toLowerCase();
    return combined.includes('trail') || combined.includes('off-road') || combined.includes('terrain');
  }

  function detectGender() {
    const url = window.location.href.toLowerCase();
    const h1 = document.querySelector('h1')?.textContent?.toLowerCase() || '';
    const combined = url + ' ' + h1;
    if (combined.includes('women') || combined.includes('female') || combined.includes('/w/')) return 'womens';
    if (combined.includes('men') || combined.includes('male') || combined.includes('/m/')) return 'mens';
    return 'mens';
  }

  // -------------------------------------------------------------------------
  // Main execution
  // -------------------------------------------------------------------------

  function run() {
    // Try detection strategies in order of confidence
    const result = detectFromJsonLd() || detectFromOpenGraph() || detectFromDOM();

    if (result) {
      chrome.runtime.sendMessage({
        type: 'SCRAPE_MODEL',
        brandName: result.brandName,
        modelName: result.modelName,
        modelFamily: result.modelFamily,
        version: result.version,
        category: result.category,
        gender: detectGender(),
      });
      console.log(
        `[FitShift] Detected ${result.brandName} ${result.modelName} on retailer (${result.source}, ${result.confidence} confidence)`
      );
    }
  }

  // Run after page load with a delay to let dynamic content render
  if (document.readyState === 'complete') {
    setTimeout(run, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(run, 1500));
  }
})();
