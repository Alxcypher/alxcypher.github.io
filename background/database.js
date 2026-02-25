/**
 * SizeCompare — Database Layer
 *
 * Uses sql.js (SQLite compiled to WebAssembly) with IndexedDB persistence.
 * All database operations flow through this module.
 */

const IDB_NAME = 'SizeCompareDB';
const IDB_STORE = 'sqlitedb';
const IDB_KEY = 'main';

let db = null;
let SQL = null;

// ---------------------------------------------------------------------------
// IndexedDB persistence helpers
// ---------------------------------------------------------------------------

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB() {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(IDB_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIDB() {
  if (!db) return;
  const data = db.export();
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(data, IDB_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Schema creation
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    website_url TEXT,
    size_chart_url TEXT
  );

  CREATE TABLE IF NOT EXISTS models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    UNIQUE (brand_id, name)
  );

  CREATE TABLE IF NOT EXISTS size_charts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    gender TEXT NOT NULL,
    us_size REAL NOT NULL,
    uk_size REAL,
    eu_size REAL,
    cm_length REAL,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    UNIQUE (brand_id, gender, us_size)
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    height_cm REAL,
    weight_kg REAL,
    foot_length_cm REAL,
    foot_width TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_model_id INTEGER,
    reference_size_us REAL NOT NULL,
    reference_gender TEXT NOT NULL,
    compared_model_id INTEGER,
    compared_size_us REAL NOT NULL,
    compared_gender TEXT NOT NULL,
    fit_rating TEXT NOT NULL,
    fit_offset REAL DEFAULT 0,
    user_height_cm REAL,
    user_weight_kg REAL,
    user_foot_length_cm REAL,
    source TEXT DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reference_model_id) REFERENCES models(id),
    FOREIGN KEY (compared_model_id) REFERENCES models(id)
  );

  CREATE TABLE IF NOT EXISTS scraped_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url TEXT NOT NULL,
    source_site TEXT NOT NULL,
    brand_name TEXT,
    model_name TEXT,
    raw_sizing_text TEXT,
    parsed_fit TEXT,
    parsed_offset REAL,
    scraped_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);
  CREATE INDEX IF NOT EXISTS idx_size_charts_brand_gender ON size_charts(brand_id, gender);
  CREATE INDEX IF NOT EXISTS idx_fit_reports_reference ON fit_reports(reference_model_id);
  CREATE INDEX IF NOT EXISTS idx_fit_reports_compared ON fit_reports(compared_model_id);
  CREATE INDEX IF NOT EXISTS idx_fit_reports_source ON fit_reports(source);
`;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function initDatabase() {
  if (db) return db;

  // Load sql.js WASM
  if (!SQL) {
    // importScripts approach for service worker context
    importScripts(chrome.runtime.getURL('lib/sql-wasm.js'));
    SQL = await initSqlJs({
      locateFile: () => chrome.runtime.getURL('lib/sql-wasm.wasm'),
    });
  }

  // Try to load existing DB from IndexedDB
  const savedData = await loadFromIDB();
  if (savedData) {
    db = new SQL.Database(new Uint8Array(savedData));
    console.log('[SizeCompare] Database loaded from IndexedDB');
  } else {
    db = new SQL.Database();
    console.log('[SizeCompare] New database created');
  }

  // Ensure schema exists (IF NOT EXISTS makes this safe to run always)
  db.run(SCHEMA_SQL);
  await saveToIDB();

  return db;
}

// ---------------------------------------------------------------------------
// Persistence — call after any write operation
// ---------------------------------------------------------------------------

async function persist() {
  await saveToIDB();
}

// ---------------------------------------------------------------------------
// Brand operations
// ---------------------------------------------------------------------------

function insertBrand(name, websiteUrl, sizeChartUrl) {
  db.run(
    'INSERT OR IGNORE INTO brands (name, website_url, size_chart_url) VALUES (?, ?, ?)',
    [name, websiteUrl || null, sizeChartUrl || null]
  );
}

function getAllBrands() {
  return db.exec('SELECT id, name, website_url, size_chart_url FROM brands ORDER BY name');
}

function getBrandByName(name) {
  const stmt = db.prepare('SELECT id, name, website_url, size_chart_url FROM brands WHERE name = ?');
  stmt.bind([name]);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

// ---------------------------------------------------------------------------
// Model operations
// ---------------------------------------------------------------------------

function insertModel(brandId, name, category) {
  db.run(
    'INSERT OR IGNORE INTO models (brand_id, name, category) VALUES (?, ?, ?)',
    [brandId, name, category || null]
  );
}

function getModelsByBrand(brandId) {
  const stmt = db.prepare(
    'SELECT id, brand_id, name, category, is_active FROM models WHERE brand_id = ? AND is_active = 1 ORDER BY name'
  );
  stmt.bind([brandId]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function getModelById(modelId) {
  const stmt = db.prepare(
    'SELECT m.id, m.brand_id, m.name, m.category, b.name as brand_name FROM models m JOIN brands b ON m.brand_id = b.id WHERE m.id = ?'
  );
  stmt.bind([modelId]);
  const result = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return result;
}

function searchModels(query) {
  const stmt = db.prepare(
    `SELECT m.id, m.brand_id, m.name, m.category, b.name as brand_name
     FROM models m JOIN brands b ON m.brand_id = b.id
     WHERE m.name LIKE ? AND m.is_active = 1
     ORDER BY b.name, m.name LIMIT 50`
  );
  stmt.bind(['%' + query + '%']);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ---------------------------------------------------------------------------
// Size chart operations
// ---------------------------------------------------------------------------

function insertSizeChart(brandId, gender, usSize, ukSize, euSize, cmLength) {
  db.run(
    `INSERT OR REPLACE INTO size_charts (brand_id, gender, us_size, uk_size, eu_size, cm_length)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [brandId, gender, usSize, ukSize || null, euSize || null, cmLength || null]
  );
}

function getSizeChart(brandId, gender) {
  const stmt = db.prepare(
    'SELECT us_size, uk_size, eu_size, cm_length FROM size_charts WHERE brand_id = ? AND gender = ? ORDER BY us_size'
  );
  stmt.bind([brandId, gender]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function convertSize(fromBrandId, toBrandId, gender, fromUsSize) {
  // Find the cm_length for the source size, then find the closest size in the target brand
  const fromStmt = db.prepare(
    'SELECT cm_length FROM size_charts WHERE brand_id = ? AND gender = ? AND us_size = ?'
  );
  fromStmt.bind([fromBrandId, gender, fromUsSize]);
  const fromResult = fromStmt.step() ? fromStmt.getAsObject() : null;
  fromStmt.free();

  if (!fromResult || !fromResult.cm_length) return null;

  const toStmt = db.prepare(
    `SELECT us_size, uk_size, eu_size, cm_length,
            ABS(cm_length - ?) as diff
     FROM size_charts
     WHERE brand_id = ? AND gender = ?
     ORDER BY diff ASC LIMIT 1`
  );
  toStmt.bind([fromResult.cm_length, toBrandId, gender]);
  const toResult = toStmt.step() ? toStmt.getAsObject() : null;
  toStmt.free();

  return toResult;
}

// ---------------------------------------------------------------------------
// Fit report operations
// ---------------------------------------------------------------------------

function insertFitReport(report) {
  db.run(
    `INSERT INTO fit_reports
       (reference_model_id, reference_size_us, reference_gender,
        compared_model_id, compared_size_us, compared_gender,
        fit_rating, fit_offset,
        user_height_cm, user_weight_kg, user_foot_length_cm, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      report.referenceModelId,
      report.referenceSizeUs,
      report.referenceGender,
      report.comparedModelId,
      report.comparedSizeUs,
      report.comparedGender,
      report.fitRating,
      report.fitOffset || 0,
      report.userHeightCm || null,
      report.userWeightKg || null,
      report.userFootLengthCm || null,
      report.source || 'user',
    ]
  );
}

function getFitReportsForModel(modelId) {
  const stmt = db.prepare(
    `SELECT fr.*,
            rm.name as ref_model_name, rb.name as ref_brand_name,
            cm.name as comp_model_name, cb.name as comp_brand_name
     FROM fit_reports fr
     LEFT JOIN models rm ON fr.reference_model_id = rm.id
     LEFT JOIN brands rb ON rm.brand_id = rb.id
     LEFT JOIN models cm ON fr.compared_model_id = cm.id
     LEFT JOIN brands cb ON cm.brand_id = cb.id
     WHERE fr.reference_model_id = ? OR fr.compared_model_id = ?
     ORDER BY fr.created_at DESC`
  );
  stmt.bind([modelId, modelId]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function getFitSummary(referenceModelId, comparedModelId) {
  const stmt = db.prepare(
    `SELECT fit_rating, COUNT(*) as count, AVG(fit_offset) as avg_offset
     FROM fit_reports
     WHERE reference_model_id = ? AND compared_model_id = ?
     GROUP BY fit_rating`
  );
  stmt.bind([referenceModelId, comparedModelId]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function getCrossModelFitData(referenceModelId) {
  // Get all shoes compared against a reference model, with aggregated fit data
  const stmt = db.prepare(
    `SELECT
       cm.id as compared_model_id,
       cm.name as compared_model_name,
       cb.name as compared_brand_name,
       COUNT(*) as total_reports,
       SUM(CASE WHEN fr.fit_rating = 'true_to_size' THEN 1 ELSE 0 END) as tts_count,
       SUM(CASE WHEN fr.fit_rating = 'runs_small' THEN 1 ELSE 0 END) as small_count,
       SUM(CASE WHEN fr.fit_rating = 'runs_large' THEN 1 ELSE 0 END) as large_count,
       AVG(fr.fit_offset) as avg_offset
     FROM fit_reports fr
     JOIN models cm ON fr.compared_model_id = cm.id
     JOIN brands cb ON cm.brand_id = cb.id
     WHERE fr.reference_model_id = ?
     GROUP BY cm.id
     ORDER BY total_reports DESC`
  );
  stmt.bind([referenceModelId]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// ---------------------------------------------------------------------------
// User profile operations
// ---------------------------------------------------------------------------

function getOrCreateProfile() {
  const existing = db.exec('SELECT * FROM user_profiles LIMIT 1');
  if (existing.length > 0 && existing[0].values.length > 0) {
    const cols = existing[0].columns;
    const vals = existing[0].values[0];
    const profile = {};
    cols.forEach((col, i) => { profile[col] = vals[i]; });
    return profile;
  }
  db.run('INSERT INTO user_profiles DEFAULT VALUES');
  return getOrCreateProfile();
}

function updateProfile(profile) {
  db.run(
    `UPDATE user_profiles SET
       height_cm = ?, weight_kg = ?, foot_length_cm = ?, foot_width = ?
     WHERE id = (SELECT id FROM user_profiles LIMIT 1)`,
    [
      profile.heightCm || null,
      profile.weightKg || null,
      profile.footLengthCm || null,
      profile.footWidth || null,
    ]
  );
}

// ---------------------------------------------------------------------------
// Scraped review operations
// ---------------------------------------------------------------------------

function insertScrapedReview(review) {
  db.run(
    `INSERT INTO scraped_reviews
       (source_url, source_site, brand_name, model_name, raw_sizing_text, parsed_fit, parsed_offset)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      review.sourceUrl,
      review.sourceSite,
      review.brandName || null,
      review.modelName || null,
      review.rawSizingText || null,
      review.parsedFit || null,
      review.parsedOffset || null,
    ]
  );
}

// ---------------------------------------------------------------------------
// Seed data loader
// ---------------------------------------------------------------------------

async function seedFromJSON(seedData) {
  if (!seedData || !seedData.brands) return;

  for (const brandData of seedData.brands) {
    insertBrand(brandData.name, brandData.website_url, brandData.size_chart_url);
    const brand = getBrandByName(brandData.name);
    if (!brand) continue;

    // Seed models
    if (brandData.models) {
      for (const model of brandData.models) {
        insertModel(brand.id, model.name, model.category);
      }
    }

    // Seed size charts
    if (brandData.size_charts) {
      for (const chart of brandData.size_charts) {
        for (const entry of chart.sizes) {
          insertSizeChart(
            brand.id,
            chart.gender,
            entry.us,
            entry.uk,
            entry.eu,
            entry.cm
          );
        }
      }
    }
  }

  await saveToIDB();
  console.log('[SizeCompare] Seed data loaded successfully');
}

// ---------------------------------------------------------------------------
// Database stats (for debugging)
// ---------------------------------------------------------------------------

function getStats() {
  const brandCount = db.exec('SELECT COUNT(*) FROM brands')[0]?.values[0][0] || 0;
  const modelCount = db.exec('SELECT COUNT(*) FROM models')[0]?.values[0][0] || 0;
  const sizeChartCount = db.exec('SELECT COUNT(*) FROM size_charts')[0]?.values[0][0] || 0;
  const fitReportCount = db.exec('SELECT COUNT(*) FROM fit_reports')[0]?.values[0][0] || 0;
  const scrapedCount = db.exec('SELECT COUNT(*) FROM scraped_reviews')[0]?.values[0][0] || 0;
  return { brandCount, modelCount, sizeChartCount, fitReportCount, scrapedCount };
}
