/**
 * FitShift — Background Service Worker
 *
 * Central coordinator: initializes the database, handles messages from
 * popup and content scripts, seeds data on install.
 *
 * Uses importScripts (not ES modules) for compatibility with sql.js WASM.
 */

// Load sql.js WASM engine and extension modules (must be top-level in MV3)
importScripts('../lib/sql-wasm.js', 'database.js', 'scraper.js', 'supabase-config.js', 'auth.js', 'sync.js');

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
      console.log('[FitShift] Database ready');
    });
  }
  return dbReadyPromise;
}

// Open the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[FitShift] Failed to set panel behavior:', error));

// ---------------------------------------------------------------------------
// Install handler — seed data on first install
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install' || details.reason === 'update') {
    console.log(`[FitShift] Extension ${details.reason}ed — seeding database`);
    await ensureDB();

    // Load and apply seed size data
    try {
      const response = await fetch(chrome.runtime.getURL('data/seed-sizes.json'));
      const seedData = await response.json();
      await seedFromJSON(seedData);
      const stats = getStats();
      console.log('[FitShift] Seed complete:', stats);
    } catch (err) {
      console.error('[FitShift] Failed to load seed data:', err);
    }

    // Load brand registry to ensure all registered brands exist
    try {
      const response = await fetch(chrome.runtime.getURL('data/brand-registry.json'));
      const registry = await response.json();
      for (const brand of registry.brands) {
        insertBrand(brand.name, `https://${brand.domain}`, brand.sizeChartUrl || null);
      }
      await persist();
      console.log('[FitShift] Brand registry loaded');
    } catch (err) {
      console.error('[FitShift] Failed to load brand registry:', err);
    }

    // Load and apply seed fit consensus data
    try {
      const fitResponse = await fetch(chrome.runtime.getURL('data/seed-fit-data.json'));
      const fitData = await fitResponse.json();
      await seedFitData(fitData);
      console.log('[FitShift] Seed fit data loaded');
    } catch (err) {
      console.error('[FitShift] Failed to load seed fit data:', err);
    }

    // Detect old Firebase auth state and flag for migration
    if (details.reason === 'update') {
      try {
        const stored = await chrome.storage.local.get('fitshift_auth');
        const oldAuth = stored.fitshift_auth;
        if (oldAuth && oldAuth.firebaseUid) {
          await chrome.storage.local.set({ fitshift_firebase_migration: true });
          await chrome.storage.local.remove('fitshift_auth');
          console.log('[FitShift] Detected old Firebase auth — flagged for migration');
        }
      } catch (migErr) {
        console.error('[FitShift] Migration detection failed:', migErr);
      }
    }

    // Set up periodic reference data refresh alarm (every 24h)
    chrome.alarms.create('fitshift_refresh_reference', { periodInMinutes: 24 * 60 });
    console.log('[FitShift] Reference data refresh alarm set (24h interval)');
  }
});

// ---------------------------------------------------------------------------
// Alarm handler — periodic reference data refresh
// ---------------------------------------------------------------------------

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'fitshift_refresh_reference') {
    const state = getCachedAuthState();
    if (!state.signedIn) return;

    try {
      await ensureDB();
      const token = await ensureValidToken();
      if (token) {
        await syncReferenceData(token);
        await flushPendingSync();
        console.log('[FitShift] Periodic reference data refresh complete');
      }
    } catch (e) {
      console.error('[FitShift] Periodic refresh failed:', e);
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
      console.error('[FitShift] Message handler error:', err);
      sendResponse({ error: err.message });
    });
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender) {
  await ensureDB();

  switch (message.type) {
    // --- Auth ---
    case 'SIGN_IN':
      return await signIn();

    case 'SIGN_OUT':
      return await signOut();

    case 'GET_AUTH_STATE':
      return await getAuthState();

    // --- Brand queries ---
    case 'GET_BRANDS':
      return { data: getAllBrands() };

    case 'GET_BRAND_BY_NAME':
      return { data: getBrandByName(message.name) };

    // --- Model queries ---
    case 'GET_MODELS':
      if (!message.brandId) return { error: 'brandId is required' };
      return { data: getModelsByBrand(message.brandId) };

    case 'GET_MODEL':
      if (!message.modelId) return { error: 'modelId is required' };
      return { data: getModelById(message.modelId) };

    case 'SEARCH_MODELS':
      if (!message.query || typeof message.query !== 'string') return { error: 'query string is required' };
      return { data: searchModels(message.query) };

    // --- Size chart queries ---
    case 'GET_SIZE_CHART':
      if (!message.brandId || !message.gender) return { error: 'brandId and gender are required' };
      return { data: getSizeChart(message.brandId, message.gender) };

    case 'CONVERT_SIZE': {
      const sizeVal = message.sizeValue ?? message.fromUsSize;
      if (!message.fromBrandId || !message.toBrandId || !message.gender || sizeVal == null) {
        return { error: 'fromBrandId, toBrandId, gender, and sizeValue are required' };
      }
      return {
        data: convertSizeFromSystem(
          message.fromBrandId,
          message.toBrandId,
          message.gender,
          sizeVal,
          message.sizeSystem || 'us'
        ),
      };
    }

    case 'GET_SIZE_OPTIONS':
      if (!message.brandId || !message.gender) return { error: 'brandId and gender are required' };
      return {
        data: getSizeOptions(message.brandId, message.gender, message.sizeSystem || 'us'),
      };

    // --- Fit report operations ---
    case 'SUBMIT_FIT_REPORT': {
      if (!message.report) return { error: 'report object is required' };
      const r = message.report;
      if (!r.referenceModelId || !r.comparedModelId || !r.fitRating) {
        return { error: 'referenceModelId, comparedModelId, and fitRating are required' };
      }
      insertFitReport(r);
      await persist();
      triggerSyncIfSignedIn();
      return { success: true };
    }

    case 'GET_FIT_REPORTS':
      return { data: getFitReportsForModel(message.modelId) };

    case 'GET_FIT_SUMMARY':
      return {
        data: getFitSummary(message.referenceModelId, message.comparedModelId),
      };

    case 'GET_CROSS_MODEL_FIT':
      return { data: getCrossModelFitData(message.referenceModelId) };

    case 'GET_MODEL_FIT_CONSENSUS':
      if (!message.modelId) return { error: 'modelId is required' };
      return { data: getModelFitConsensus(message.modelId) };

    case 'GET_VERSION_FIT_NOTES':
      return { data: getVersionFitNotes(message.modelId) };

    // --- User profile ---
    case 'GET_PROFILE':
      return { data: getOrCreateProfile() };

    case 'UPDATE_PROFILE':
      updateProfile(message.profile);
      await persist();
      triggerSyncIfSignedIn();
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
        `[FitShift] Ingested ${normalized.length} size chart entries for ${message.brandName}`
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

    // --- User shoe collection ---
    case 'ADD_USER_SHOE': {
      if (!message.brandId || message.sizeValue == null) {
        return { error: 'brandId and sizeValue are required' };
      }
      const shoeId = insertUserShoe(
        message.brandId, message.modelId, message.gender,
        message.sizeSystem, message.sizeValue, message.nickname
      );
      await persist();
      triggerSyncIfSignedIn();
      return { success: true, shoeId };
    }

    case 'GET_USER_SHOES':
      return { data: getUserShoes() };

    case 'DELETE_USER_SHOE':
      if (!message.shoeId) return { error: 'shoeId is required' };
      deleteUserShoe(message.shoeId);
      await persist();
      triggerSyncIfSignedIn();
      return { success: true };

    // --- Data export/import ---
    case 'EXPORT_USER_DATA':
      return { data: exportUserData() };

    case 'IMPORT_USER_DATA': {
      if (!message.data) return { error: 'data object is required' };
      const importResult = importUserData(message.data);
      if (importResult.success) {
        await persist();
        triggerSyncIfSignedIn();
      }
      return importResult;
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
  console.log('[FitShift] Service worker activated');
  ensureDB();
});
