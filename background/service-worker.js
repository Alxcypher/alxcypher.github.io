/**
 * SizeCompare — Background Service Worker
 *
 * Central coordinator: initializes the database, handles messages from
 * popup and content scripts, seeds data on install.
 *
 * Uses importScripts (not ES modules) for compatibility with sql.js WASM.
 */

// Load database and scraper modules (they define functions in global scope)
importScripts('database.js', 'scraper.js');

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

let dbReady = false;
let dbReadyPromise = null;

async function ensureDB() {
  if (dbReady) return;
  if (!dbReadyPromise) {
    dbReadyPromise = initDatabase().then(() => {
      dbReady = true;
      console.log('[SizeCompare] Database ready');
    });
  }
  return dbReadyPromise;
}

// ---------------------------------------------------------------------------
// Install handler — seed data on first install
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    console.log(`[SizeCompare] Extension ${details.reason}ed — seeding database`);
    await ensureDB();

    // Load and apply seed size data
    try {
      const response = await fetch(chrome.runtime.getURL('data/seed-sizes.json'));
      const seedData = await response.json();
      await seedFromJSON(seedData);
      const stats = getStats();
      console.log('[SizeCompare] Seed complete:', stats);
    } catch (err) {
      console.error('[SizeCompare] Failed to load seed data:', err);
    }

    // Load brand registry to ensure all registered brands exist
    try {
      const response = await fetch(chrome.runtime.getURL('data/brand-registry.json'));
      const registry = await response.json();
      for (const brand of registry.brands) {
        insertBrand(brand.name, `https://${brand.domain}`, brand.sizeChartUrl || null);
      }
      await persist();
      console.log('[SizeCompare] Brand registry loaded');
    } catch (err) {
      console.error('[SizeCompare] Failed to load brand registry:', err);
    }
  }
});

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((err) => {
      console.error('[SizeCompare] Message handler error:', err);
      sendResponse({ error: err.message });
    });
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender) {
  await ensureDB();

  switch (message.type) {
    // --- Brand queries ---
    case 'GET_BRANDS':
      return { data: getAllBrands() };

    case 'GET_BRAND_BY_NAME':
      return { data: getBrandByName(message.name) };

    // --- Model queries ---
    case 'GET_MODELS':
      return { data: getModelsByBrand(message.brandId) };

    case 'GET_MODEL':
      return { data: getModelById(message.modelId) };

    case 'SEARCH_MODELS':
      return { data: searchModels(message.query) };

    // --- Size chart queries ---
    case 'GET_SIZE_CHART':
      return { data: getSizeChart(message.brandId, message.gender) };

    case 'CONVERT_SIZE':
      return {
        data: convertSizeFromSystem(
          message.fromBrandId,
          message.toBrandId,
          message.gender,
          message.sizeValue ?? message.fromUsSize,
          message.sizeSystem || 'us'
        ),
      };

    case 'GET_SIZE_OPTIONS':
      return {
        data: getSizeOptions(message.brandId, message.gender, message.sizeSystem || 'us'),
      };

    // --- Fit report operations ---
    case 'SUBMIT_FIT_REPORT':
      insertFitReport(message.report);
      await persist();
      return { success: true };

    case 'GET_FIT_REPORTS':
      return { data: getFitReportsForModel(message.modelId) };

    case 'GET_FIT_SUMMARY':
      return {
        data: getFitSummary(message.referenceModelId, message.comparedModelId),
      };

    case 'GET_CROSS_MODEL_FIT':
      return { data: getCrossModelFitData(message.referenceModelId) };

    // --- User profile ---
    case 'GET_PROFILE':
      return { data: getOrCreateProfile() };

    case 'UPDATE_PROFILE':
      updateProfile(message.profile);
      await persist();
      return { success: true };

    // --- Scraped data ingestion (from content scripts) ---
    case 'SCRAPE_SIZE_CHART': {
      let brand = getBrandByName(message.brandName);
      if (!brand) {
        insertBrand(message.brandName, null, null);
        await persist();
        brand = getBrandByName(message.brandName);
      }
      const normalized = normalizeSizeChartData(message.data, message.brandName);
      for (const entry of normalized) {
        insertSizeChart(
          brand.id,
          message.gender || 'mens',
          entry.us,
          entry.uk,
          entry.eu,
          entry.cm
        );
      }
      await persist();
      console.log(
        `[SizeCompare] Ingested ${normalized.length} size chart entries for ${message.brandName}`
      );
      return { success: true, count: normalized.length };
    }

    case 'SCRAPE_MODEL': {
      let brand = getBrandByName(message.brandName);
      if (!brand) {
        insertBrand(message.brandName, null, null);
        await persist();
        brand = getBrandByName(message.brandName);
      }
      if (brand) {
        const versionInfo = parseModelVersion(message.modelName);
        insertModel(
          brand.id,
          versionInfo.displayName,
          message.category || null,
          message.modelFamily || versionInfo.family,
          message.version || versionInfo.version,
          message.year || null
        );
        await persist();
      }
      return { success: true };
    }

    case 'GET_MODEL_FAMILY':
      return { data: getModelsByFamily(message.brandId, message.modelFamily) };

    case 'GET_FIT_SUMMARY_FAMILY':
      return {
        data: getFitSummaryForFamily(
          message.referenceModelId,
          message.comparedModelFamily,
          message.comparedBrandId
        ),
      };

    case 'SCRAPE_FIT_DATA': {
      // From RunRepeat or similar — raw review data
      const reviewData = extractRunRepeatData(message);
      insertScrapedReview(reviewData);

      // If we can parse it, also create a fit report
      if (reviewData.parsedFit && message.brandName && message.modelName) {
        const brand = getBrandByName(normalizeBrandName(message.brandName));
        if (brand) {
          // Try exact match first, then family match
          const models = getModelsByBrand(brand.id);
          let model = models.find(
            (m) => m.name.toLowerCase() === message.modelName.toLowerCase()
          );
          if (!model) {
            const vInfo = parseModelVersion(message.modelName);
            model = models.find(
              (m) => m.model_family && m.model_family.toLowerCase() === vInfo.family.toLowerCase()
            );
          }
          if (model) {
            insertFitReport({
              referenceModelId: model.id,
              referenceSizeUs: 10,
              referenceGender: 'mens',
              comparedModelId: model.id,
              comparedSizeUs: 10,
              comparedGender: 'mens',
              fitRating: reviewData.parsedFit,
              fitOffset: reviewData.parsedOffset || 0,
              source: 'scraped_runrepeat',
            });
          }
        }
      }

      await persist();
      return { success: true };
    }

    // --- Stats ---
    case 'GET_STATS':
      return { data: getStats() };

    default:
      return { error: `Unknown message type: ${message.type}` };
  }
}

// ---------------------------------------------------------------------------
// Service worker lifecycle
// ---------------------------------------------------------------------------

self.addEventListener('activate', () => {
  console.log('[SizeCompare] Service worker activated');
  ensureDB();
});
