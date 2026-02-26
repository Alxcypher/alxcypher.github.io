/**
 * FitShift — Database Layer
 *
 * Uses sql.js (SQLite compiled to WebAssembly) with IndexedDB persistence.
 * All database operations flow through this module.
 */

const IDB_NAME = 'FitShiftDB';
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

  CREATE TABLE IF NOT EXISTS seed_fit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_model_id INTEGER,
    reference_size_us REAL NOT NULL,
    reference_gender TEXT NOT NULL,
    compared_model_id INTEGER,
    compared_size_us REAL NOT NULL,
    compared_gender TEXT NOT NULL,
    fit_rating TEXT NOT NULL,
    fit_offset REAL DEFAULT 0,
    width_rating TEXT DEFAULT 'true_to_width',
    user_height_cm REAL,
    user_weight_kg REAL,
    user_foot_length_cm REAL,
    source TEXT DEFAULT 'seed',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reference_model_id) REFERENCES models(id),
    FOREIGN KEY (compared_model_id) REFERENCES models(id)
  );

  CREATE TABLE IF NOT EXISTS user_fit_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference_model_id INTEGER,
    reference_size_us REAL NOT NULL,
    reference_gender TEXT NOT NULL,
    compared_model_id INTEGER,
    compared_size_us REAL NOT NULL,
    compared_gender TEXT NOT NULL,
    fit_rating TEXT NOT NULL,
    fit_offset REAL DEFAULT 0,
    width_rating TEXT DEFAULT 'true_to_width',
    user_height_cm REAL,
    user_weight_kg REAL,
    user_foot_length_cm REAL,
    source TEXT DEFAULT 'user',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (reference_model_id) REFERENCES models(id),
    FOREIGN KEY (compared_model_id) REFERENCES models(id)
  );

  CREATE VIEW IF NOT EXISTS fit_reports AS
    SELECT id, reference_model_id, reference_size_us, reference_gender,
           compared_model_id, compared_size_us, compared_gender,
           fit_rating, fit_offset, width_rating,
           user_height_cm, user_weight_kg, user_foot_length_cm,
           source, created_at
    FROM seed_fit_reports
    UNION ALL
    SELECT id, reference_model_id, reference_size_us, reference_gender,
           compared_model_id, compared_size_us, compared_gender,
           fit_rating, fit_offset, width_rating,
           user_height_cm, user_weight_kg, user_foot_length_cm,
           source, created_at
    FROM user_fit_reports;

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

  CREATE TABLE IF NOT EXISTS user_shoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id INTEGER NOT NULL,
    model_id INTEGER,
    gender TEXT DEFAULT 'mens',
    size_system TEXT DEFAULT 'us',
    size_value REAL NOT NULL,
    nickname TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (brand_id) REFERENCES brands(id),
    FOREIGN KEY (model_id) REFERENCES models(id)
  );

  CREATE INDEX IF NOT EXISTS idx_models_brand ON models(brand_id);
  CREATE INDEX IF NOT EXISTS idx_size_charts_brand_gender ON size_charts(brand_id, gender);
  CREATE INDEX IF NOT EXISTS idx_seed_fit_reports_reference ON seed_fit_reports(reference_model_id);
  CREATE INDEX IF NOT EXISTS idx_seed_fit_reports_compared ON seed_fit_reports(compared_model_id);
  CREATE INDEX IF NOT EXISTS idx_user_fit_reports_reference ON user_fit_reports(reference_model_id);
  CREATE INDEX IF NOT EXISTS idx_user_fit_reports_compared ON user_fit_reports(compared_model_id);
  CREATE INDEX IF NOT EXISTS idx_user_shoes_brand ON user_shoes(brand_id);
`;

// ---------------------------------------------------------------------------
// Schema migration — add version tracking columns
// ---------------------------------------------------------------------------

const MIGRATION_SQL = [
  'ALTER TABLE models ADD COLUMN model_family TEXT',
  'ALTER TABLE models ADD COLUMN version TEXT',
  'ALTER TABLE models ADD COLUMN year INTEGER',
  'CREATE INDEX IF NOT EXISTS idx_models_family ON models(brand_id, model_family)',
];

// Migration: move data from old fit_reports table to split tables
const FIT_REPORTS_MIGRATION_SQL = [
  // Copy seed rows into seed_fit_reports
  `INSERT OR IGNORE INTO seed_fit_reports
     (reference_model_id, reference_size_us, reference_gender,
      compared_model_id, compared_size_us, compared_gender,
      fit_rating, fit_offset, width_rating,
      user_height_cm, user_weight_kg, user_foot_length_cm, source, created_at)
   SELECT reference_model_id, reference_size_us, reference_gender,
          compared_model_id, compared_size_us, compared_gender,
          fit_rating, fit_offset, width_rating,
          user_height_cm, user_weight_kg, user_foot_length_cm, source, created_at
   FROM _old_fit_reports WHERE source = 'seed'`,
  // Copy user rows into user_fit_reports
  `INSERT OR IGNORE INTO user_fit_reports
     (reference_model_id, reference_size_us, reference_gender,
      compared_model_id, compared_size_us, compared_gender,
      fit_rating, fit_offset, width_rating,
      user_height_cm, user_weight_kg, user_foot_length_cm, source, created_at)
   SELECT reference_model_id, reference_size_us, reference_gender,
          compared_model_id, compared_size_us, compared_gender,
          fit_rating, fit_offset, width_rating,
          user_height_cm, user_weight_kg, user_foot_length_cm, source, created_at
   FROM _old_fit_reports WHERE source != 'seed'`,
  'DROP TABLE IF EXISTS _old_fit_reports',
];

function runMigrations() {
  for (const sql of MIGRATION_SQL) {
    try {
      db.run(sql);
    } catch (e) {
      // Column/index already exists — safe to ignore
    }
  }
  // Backfill: set model_family = name for any rows that don't have it
  db.run('UPDATE models SET model_family = name WHERE model_family IS NULL');

  // Migrate old fit_reports table to split tables if it exists as a real table
  try {
    const tableCheck = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='fit_reports'"
    );
    if (tableCheck.length > 0 && tableCheck[0].values.length > 0) {
      // Old fit_reports is a real table — rename and migrate
      db.run('ALTER TABLE fit_reports RENAME TO _old_fit_reports');
      // Re-run schema to create the new tables and view
      db.run(SCHEMA_SQL);
      for (const sql of FIT_REPORTS_MIGRATION_SQL) {
        db.run(sql);
      }
      console.log('[FitShift] Migrated fit_reports to split tables');
    }
  } catch (e) {
    // Already migrated or tables don't exist yet — safe to ignore
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function initDatabase() {
  if (db) return db;

  // Initialize sql.js WASM (already loaded via top-level importScripts)
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => chrome.runtime.getURL('lib/sql-wasm.wasm'),
    });
  }

  // Try to load existing DB from IndexedDB
  const savedData = await loadFromIDB();
  if (savedData) {
    db = new SQL.Database(new Uint8Array(savedData));
    console.log('[FitShift] Database loaded from IndexedDB');
  } else {
    db = new SQL.Database();
    console.log('[FitShift] New database created');
  }

  // Ensure schema exists (IF NOT EXISTS makes this safe to run always)
  db.run(SCHEMA_SQL);
  runMigrations();
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
  try {
    db.run(
      'INSERT OR IGNORE INTO brands (name, website_url, size_chart_url) VALUES (?, ?, ?)',
      [name, websiteUrl || null, sizeChartUrl || null]
    );
  } catch (e) {
    console.error('[FitShift] insertBrand error:', e);
  }
}

function getAllBrands() {
  try {
    return db.exec('SELECT id, name, website_url, size_chart_url FROM brands ORDER BY name');
  } catch (e) {
    console.error('[FitShift] getAllBrands error:', e);
    return [];
  }
}

function getBrandByName(name) {
  try {
    const stmt = db.prepare('SELECT id, name, website_url, size_chart_url FROM brands WHERE name = ?');
    try {
      stmt.bind([name]);
      return stmt.step() ? stmt.getAsObject() : null;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getBrandByName error:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Model operations
// ---------------------------------------------------------------------------

function insertModel(brandId, name, category, modelFamily, version, year) {
  try {
    db.run(
      `INSERT OR IGNORE INTO models (brand_id, name, category, model_family, version, year)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [brandId, name, category || null, modelFamily || name, version || null, year || null]
    );
  } catch (e) {
    console.error('[FitShift] insertModel error:', e);
  }
}

function getModelsByBrand(brandId) {
  try {
    const stmt = db.prepare(
      `SELECT id, brand_id, name, category, model_family, version, year, is_active
       FROM models WHERE brand_id = ? AND is_active = 1 ORDER BY model_family, version DESC`
    );
    try {
      stmt.bind([brandId]);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getModelsByBrand error:', e);
    return [];
  }
}

function getModelById(modelId) {
  try {
    const stmt = db.prepare(
      `SELECT m.id, m.brand_id, m.name, m.category, m.model_family, m.version, m.year,
              b.name as brand_name
       FROM models m JOIN brands b ON m.brand_id = b.id WHERE m.id = ?`
    );
    try {
      stmt.bind([modelId]);
      return stmt.step() ? stmt.getAsObject() : null;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getModelById error:', e);
    return null;
  }
}

function getModelsByFamily(brandId, modelFamily) {
  try {
    const stmt = db.prepare(
      `SELECT id, brand_id, name, category, model_family, version, year
       FROM models WHERE brand_id = ? AND model_family = ? AND is_active = 1
       ORDER BY version DESC`
    );
    try {
      stmt.bind([brandId, modelFamily]);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getModelsByFamily error:', e);
    return [];
  }
}

function searchModels(query) {
  try {
    const stmt = db.prepare(
      `SELECT m.id, m.brand_id, m.name, m.category, m.model_family, m.version, m.year,
              b.name as brand_name
       FROM models m JOIN brands b ON m.brand_id = b.id
       WHERE (m.name LIKE ? OR m.model_family LIKE ?) AND m.is_active = 1
       ORDER BY b.name, m.model_family, m.version DESC LIMIT 50`
    );
    try {
      stmt.bind(['%' + query + '%', '%' + query + '%']);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] searchModels error:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Size chart operations
// ---------------------------------------------------------------------------

function insertSizeChart(brandId, gender, usSize, ukSize, euSize, cmLength) {
  try {
    db.run(
      `INSERT OR REPLACE INTO size_charts (brand_id, gender, us_size, uk_size, eu_size, cm_length)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [brandId, gender, usSize, ukSize || null, euSize || null, cmLength || null]
    );
  } catch (e) {
    console.error('[FitShift] insertSizeChart error:', e);
  }
}

function getSizeChart(brandId, gender) {
  try {
    const stmt = db.prepare(
      'SELECT us_size, uk_size, eu_size, cm_length FROM size_charts WHERE brand_id = ? AND gender = ? ORDER BY us_size'
    );
    try {
      stmt.bind([brandId, gender]);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getSizeChart error:', e);
    return [];
  }
}

function convertSize(fromBrandId, toBrandId, gender, fromUsSize) {
  return convertSizeFromSystem(fromBrandId, toBrandId, gender, fromUsSize, 'us');
}

function convertSizeFromSystem(fromBrandId, toBrandId, gender, sizeValue, sizeSystem) {
  try {
    // Map system name to column
    const colMap = { us: 'us_size', uk: 'uk_size', eu: 'eu_size' };
    const sizeCol = colMap[sizeSystem] || 'us_size';

    // Find the cm_length for the source size in the given system
    let fromResult = null;
    const fromStmt = db.prepare(
      `SELECT cm_length FROM size_charts WHERE brand_id = ? AND gender = ? AND ${sizeCol} = ?`
    );
    try {
      fromStmt.bind([fromBrandId, gender, sizeValue]);
      fromResult = fromStmt.step() ? fromStmt.getAsObject() : null;
    } finally {
      fromStmt.free();
    }

    // If exact match not found for UK/EU (which can have odd values), find closest
    let cmLength = fromResult?.cm_length;
    if (!cmLength) {
      const closestStmt = db.prepare(
        `SELECT cm_length, ABS(${sizeCol} - ?) as diff
         FROM size_charts
         WHERE brand_id = ? AND gender = ? AND ${sizeCol} IS NOT NULL
         ORDER BY diff ASC LIMIT 1`
      );
      try {
        closestStmt.bind([sizeValue, fromBrandId, gender]);
        const closestResult = closestStmt.step() ? closestStmt.getAsObject() : null;
        cmLength = closestResult?.cm_length;
      } finally {
        closestStmt.free();
      }
    }

    if (!cmLength) return null;

    const toStmt = db.prepare(
      `SELECT us_size, uk_size, eu_size, cm_length,
              ABS(cm_length - ?) as diff
       FROM size_charts
       WHERE brand_id = ? AND gender = ?
       ORDER BY diff ASC LIMIT 1`
    );
    try {
      toStmt.bind([cmLength, toBrandId, gender]);
      return toStmt.step() ? toStmt.getAsObject() : null;
    } finally {
      toStmt.free();
    }
  } catch (e) {
    console.error('[FitShift] convertSizeFromSystem error:', e);
    return null;
  }
}

function getSizeOptions(brandId, gender, sizeSystem) {
  try {
    // Return distinct size values for a given system, used to populate dropdowns
    const colMap = { us: 'us_size', uk: 'uk_size', eu: 'eu_size' };
    const sizeCol = colMap[sizeSystem] || 'us_size';

    const stmt = db.prepare(
      `SELECT DISTINCT ${sizeCol} as size_val FROM size_charts
       WHERE brand_id = ? AND gender = ? AND ${sizeCol} IS NOT NULL
       ORDER BY ${sizeCol} ASC`
    );
    try {
      stmt.bind([brandId, gender]);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject().size_val);
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getSizeOptions error:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fit report operations
// ---------------------------------------------------------------------------

function insertFitReport(report) {
  try {
    const table = report.source === 'seed' ? 'seed_fit_reports' : 'user_fit_reports';
    db.run(
      `INSERT INTO ${table}
         (reference_model_id, reference_size_us, reference_gender,
          compared_model_id, compared_size_us, compared_gender,
          fit_rating, fit_offset, width_rating,
          user_height_cm, user_weight_kg, user_foot_length_cm, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        report.referenceModelId,
        report.referenceSizeUs,
        report.referenceGender,
        report.comparedModelId,
        report.comparedSizeUs,
        report.comparedGender,
        report.fitRating,
        report.fitOffset || 0,
        report.widthRating || 'true_to_width',
        report.userHeightCm || null,
        report.userWeightKg || null,
        report.userFootLengthCm || null,
        report.source || 'user',
      ]
    );
  } catch (e) {
    console.error('[FitShift] insertFitReport error:', e);
  }
}

function getFitReportsForModel(modelId) {
  try {
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
    try {
      stmt.bind([modelId, modelId]);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getFitReportsForModel error:', e);
    return [];
  }
}

function getFitSummary(referenceModelId, comparedModelId) {
  try {
    // Length fit summary
    let length = [];
    const stmt = db.prepare(
      `SELECT fit_rating, COUNT(*) as count, AVG(fit_offset) as avg_offset
       FROM fit_reports
       WHERE reference_model_id = ? AND compared_model_id = ?
       GROUP BY fit_rating`
    );
    try {
      stmt.bind([referenceModelId, comparedModelId]);
      while (stmt.step()) {
        length.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }

    // Width fit summary
    let width = [];
    const wStmt = db.prepare(
      `SELECT width_rating, COUNT(*) as count
       FROM fit_reports
       WHERE reference_model_id = ? AND compared_model_id = ?
         AND width_rating IS NOT NULL
       GROUP BY width_rating`
    );
    try {
      wStmt.bind([referenceModelId, comparedModelId]);
      while (wStmt.step()) {
        width.push(wStmt.getAsObject());
      }
    } finally {
      wStmt.free();
    }

    return { length, width };
  } catch (e) {
    console.error('[FitShift] getFitSummary error:', e);
    return { length: [], width: [] };
  }
}

function getFitSummaryForFamily(referenceModelId, comparedModelFamily, comparedBrandId) {
  try {
    // Length fit summary across all versions of a model family
    let length = [];
    const stmt = db.prepare(
      `SELECT fr.fit_rating, COUNT(*) as count, AVG(fr.fit_offset) as avg_offset
       FROM fit_reports fr
       JOIN models cm ON fr.compared_model_id = cm.id
       WHERE fr.reference_model_id = ?
         AND cm.model_family = ?
         AND cm.brand_id = ?
       GROUP BY fr.fit_rating`
    );
    try {
      stmt.bind([referenceModelId, comparedModelFamily, comparedBrandId]);
      while (stmt.step()) {
        length.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }

    // Width fit summary across all versions
    let width = [];
    const wStmt = db.prepare(
      `SELECT fr.width_rating, COUNT(*) as count
       FROM fit_reports fr
       JOIN models cm ON fr.compared_model_id = cm.id
       WHERE fr.reference_model_id = ?
         AND cm.model_family = ?
         AND cm.brand_id = ?
         AND fr.width_rating IS NOT NULL
       GROUP BY fr.width_rating`
    );
    try {
      wStmt.bind([referenceModelId, comparedModelFamily, comparedBrandId]);
      while (wStmt.step()) {
        width.push(wStmt.getAsObject());
      }
    } finally {
      wStmt.free();
    }

    return { length, width };
  } catch (e) {
    console.error('[FitShift] getFitSummaryForFamily error:', e);
    return { length: [], width: [] };
  }
}

function getCrossModelFitData(referenceModelId) {
  try {
    const stmt = db.prepare(
      `SELECT
         cm.id as compared_model_id,
         cm.name as compared_model_name,
         cb.name as compared_brand_name,
         COUNT(*) as total_reports,
         SUM(CASE WHEN fr.fit_rating = 'true_to_size' THEN 1 ELSE 0 END) as tts_count,
         SUM(CASE WHEN fr.fit_rating = 'runs_small' THEN 1 ELSE 0 END) as small_count,
         SUM(CASE WHEN fr.fit_rating = 'runs_large' THEN 1 ELSE 0 END) as large_count,
         SUM(CASE WHEN fr.width_rating = 'true_to_width' THEN 1 ELSE 0 END) as ttw_count,
         SUM(CASE WHEN fr.width_rating = 'too_narrow' THEN 1 ELSE 0 END) as narrow_count,
         SUM(CASE WHEN fr.width_rating = 'too_wide' THEN 1 ELSE 0 END) as wide_count,
         AVG(fr.fit_offset) as avg_offset
       FROM fit_reports fr
       JOIN models cm ON fr.compared_model_id = cm.id
       JOIN brands cb ON cm.brand_id = cb.id
       WHERE fr.reference_model_id = ?
       GROUP BY cm.id
       ORDER BY total_reports DESC`
    );
    try {
      stmt.bind([referenceModelId]);
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getCrossModelFitData error:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// User profile operations
// ---------------------------------------------------------------------------

function getOrCreateProfile() {
  try {
    const existing = db.exec('SELECT * FROM user_profiles LIMIT 1');
    if (existing.length > 0 && existing[0].values.length > 0) {
      const cols = existing[0].columns;
      const vals = existing[0].values[0];
      const profile = {};
      cols.forEach((col, i) => { profile[col] = vals[i]; });
      return profile;
    }
    db.run('INSERT INTO user_profiles DEFAULT VALUES');
    // Re-query directly instead of recursive call to avoid infinite recursion
    const created = db.exec('SELECT * FROM user_profiles LIMIT 1');
    if (created.length > 0 && created[0].values.length > 0) {
      const cols = created[0].columns;
      const vals = created[0].values[0];
      const profile = {};
      cols.forEach((col, i) => { profile[col] = vals[i]; });
      return profile;
    }
    return null;
  } catch (e) {
    console.error('[FitShift] getOrCreateProfile error:', e);
    return null;
  }
}

function updateProfile(profile) {
  try {
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
  } catch (e) {
    console.error('[FitShift] updateProfile error:', e);
  }
}

// ---------------------------------------------------------------------------
// User shoe collection operations
// ---------------------------------------------------------------------------

function insertUserShoe(brandId, modelId, gender, sizeSystem, sizeValue, nickname) {
  try {
    db.run(
      `INSERT INTO user_shoes (brand_id, model_id, gender, size_system, size_value, nickname)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [brandId, modelId || null, gender || 'mens', sizeSystem || 'us', sizeValue, nickname || null]
    );
    // Return the new shoe's id
    const result = db.exec('SELECT last_insert_rowid() as id');
    return result[0]?.values[0][0] || null;
  } catch (e) {
    console.error('[FitShift] insertUserShoe error:', e);
    return null;
  }
}

function getUserShoes() {
  try {
    const stmt = db.prepare(
      `SELECT us.id, us.brand_id, us.model_id, us.gender, us.size_system, us.size_value,
              us.nickname, us.created_at,
              b.name as brand_name,
              m.name as model_name, m.model_family, m.version
       FROM user_shoes us
       JOIN brands b ON us.brand_id = b.id
       LEFT JOIN models m ON us.model_id = m.id
       ORDER BY us.created_at DESC`
    );
    try {
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getUserShoes error:', e);
    return [];
  }
}

function getUserShoeById(id) {
  try {
    const stmt = db.prepare(
      `SELECT us.id, us.brand_id, us.model_id, us.gender, us.size_system, us.size_value,
              us.nickname, us.created_at,
              b.name as brand_name,
              m.name as model_name, m.model_family, m.version
       FROM user_shoes us
       JOIN brands b ON us.brand_id = b.id
       LEFT JOIN models m ON us.model_id = m.id
       WHERE us.id = ?`
    );
    try {
      stmt.bind([id]);
      return stmt.step() ? stmt.getAsObject() : null;
    } finally {
      stmt.free();
    }
  } catch (e) {
    console.error('[FitShift] getUserShoeById error:', e);
    return null;
  }
}

function deleteUserShoe(id) {
  try {
    db.run('DELETE FROM user_shoes WHERE id = ?', [id]);
  } catch (e) {
    console.error('[FitShift] deleteUserShoe error:', e);
  }
}

// ---------------------------------------------------------------------------
// Scraped review operations
// ---------------------------------------------------------------------------

function insertScrapedReview(review) {
  try {
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
  } catch (e) {
    console.error('[FitShift] insertScrapedReview error:', e);
  }
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
        insertModel(
          brand.id,
          model.name,
          model.category,
          model.model_family || null,
          model.version || null,
          model.year || null
        );
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
  console.log('[FitShift] Seed data loaded successfully');
}

// ---------------------------------------------------------------------------
// Seed fit data loader
// ---------------------------------------------------------------------------

async function seedFitData(fitData) {
  if (!fitData || !Array.isArray(fitData.models)) return;

  for (const entry of fitData.models) {
    const brand = getBrandByName(entry.brand);
    if (!brand) {
      console.warn(`[FitShift] seedFitData: unknown brand "${entry.brand}"`);
      continue;
    }

    const models = getModelsByBrand(brand.id);
    const model = models.find((m) => m.name === entry.model);
    if (!model) {
      console.warn(`[FitShift] seedFitData: unknown model "${entry.model}" for brand "${entry.brand}"`);
      continue;
    }

    // Check for existing seed row to prevent duplicates on extension update
    const checkStmt = db.prepare(
      `SELECT COUNT(*) as cnt FROM seed_fit_reports
       WHERE reference_model_id = ? AND compared_model_id = ?
         AND source = 'seed' AND reference_gender = ?`
    );
    let alreadyExists = false;
    try {
      checkStmt.bind([model.id, model.id, entry.gender]);
      if (checkStmt.step()) {
        alreadyExists = checkStmt.getAsObject().cnt > 0;
      }
    } finally {
      checkStmt.free();
    }
    if (alreadyExists) continue;

    insertFitReport({
      referenceModelId: model.id,
      referenceSizeUs: 10,
      referenceGender: entry.gender,
      comparedModelId: model.id,
      comparedSizeUs: 10,
      comparedGender: entry.gender,
      fitRating: entry.fit_rating,
      fitOffset: entry.fit_offset || 0,
      widthRating: entry.width_rating || 'true_to_width',
      source: 'seed',
    });
  }

  await saveToIDB();
  console.log('[FitShift] Seed fit data loaded successfully');
}

// ---------------------------------------------------------------------------
// Model fit consensus query
// ---------------------------------------------------------------------------

function getModelFitConsensus(modelId) {
  try {
    // Length fit from self-comparison reports
    let length = [];
    const stmt = db.prepare(
      `SELECT fit_rating, COUNT(*) as count, AVG(fit_offset) as avg_offset
       FROM fit_reports
       WHERE reference_model_id = ? AND compared_model_id = ?
       GROUP BY fit_rating`
    );
    try {
      stmt.bind([modelId, modelId]);
      while (stmt.step()) {
        length.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }

    // Width fit from self-comparison reports
    let width = [];
    const wStmt = db.prepare(
      `SELECT width_rating, COUNT(*) as count
       FROM fit_reports
       WHERE reference_model_id = ? AND compared_model_id = ?
         AND width_rating IS NOT NULL
       GROUP BY width_rating`
    );
    try {
      wStmt.bind([modelId, modelId]);
      while (wStmt.step()) {
        width.push(wStmt.getAsObject());
      }
    } finally {
      wStmt.free();
    }

    return { length, width };
  } catch (e) {
    console.error('[FitShift] getModelFitConsensus error:', e);
    return { length: [], width: [] };
  }
}

// ---------------------------------------------------------------------------
// Version-to-version fit change notes
// ---------------------------------------------------------------------------

function getDominant(data, field) {
  if (!data || data.length === 0) return null;
  let best = data[0];
  for (const row of data) {
    if (row.count > best.count) best = row;
  }
  return best[field];
}

function getVersionFitNotes(modelId) {
  try {
    const model = getModelById(modelId);
    if (!model) return [];

    const version = parseInt(model.version);
    if (!version || version <= 1) return [];

    const family = getModelsByFamily(model.brand_id, model.model_family);
    const prev = family.find((m) => parseInt(m.version) === version - 1);
    if (!prev) return [];

    const current = getModelFitConsensus(modelId);
    const previous = getModelFitConsensus(prev.id);

    const lengthScale = { runs_small: -1, true_to_size: 0, runs_large: 1 };
    const widthScale = { too_narrow: -1, true_to_width: 0, too_wide: 1 };

    const notes = [];

    const curLen = getDominant(current.length, 'fit_rating');
    const prevLen = getDominant(previous.length, 'fit_rating');
    if (curLen && prevLen && curLen !== prevLen) {
      const dir = lengthScale[curLen] > lengthScale[prevLen] ? 'larger' : 'smaller';
      notes.push(`Runs ${dir} than ${prev.name}`);
    }

    const curWid = getDominant(current.width, 'width_rating');
    const prevWid = getDominant(previous.width, 'width_rating');
    if (curWid && prevWid && curWid !== prevWid) {
      const dir = widthScale[curWid] > widthScale[prevWid] ? 'wider' : 'narrower';
      notes.push(`Runs ${dir} than ${prev.name}`);
    }

    return notes;
  } catch (e) {
    console.error('[FitShift] getVersionFitNotes error:', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Data export/import
// ---------------------------------------------------------------------------

function exportUserData() {
  try {
    const userShoes = getUserShoes();
    const profile = getOrCreateProfile();

    // Export user-submitted fit reports with brand/model names for portability
    let fitReports = [];
    const stmt = db.prepare(
      `SELECT fr.reference_size_us, fr.reference_gender,
              fr.compared_size_us, fr.compared_gender,
              fr.fit_rating, fr.fit_offset, fr.width_rating,
              fr.user_height_cm, fr.user_weight_kg, fr.user_foot_length_cm,
              fr.created_at,
              rm.name as ref_model_name, rb.name as ref_brand_name,
              cm.name as comp_model_name, cb.name as comp_brand_name
       FROM fit_reports fr
       LEFT JOIN models rm ON fr.reference_model_id = rm.id
       LEFT JOIN brands rb ON rm.brand_id = rb.id
       LEFT JOIN models cm ON fr.compared_model_id = cm.id
       LEFT JOIN brands cb ON cm.brand_id = cb.id
       WHERE fr.source = 'user'
       ORDER BY fr.created_at DESC`
    );
    try {
      while (stmt.step()) {
        fitReports.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      extensionVersion: '0.1.0',
      userProfile: profile,
      userShoes: userShoes.map((s) => ({
        brand_name: s.brand_name,
        model_name: s.model_name,
        gender: s.gender,
        size_system: s.size_system,
        size_value: s.size_value,
        nickname: s.nickname,
      })),
      fitReports: fitReports.map((r) => ({
        ref_brand_name: r.ref_brand_name,
        ref_model_name: r.ref_model_name,
        reference_size_us: r.reference_size_us,
        reference_gender: r.reference_gender,
        comp_brand_name: r.comp_brand_name,
        comp_model_name: r.comp_model_name,
        compared_size_us: r.compared_size_us,
        compared_gender: r.compared_gender,
        fit_rating: r.fit_rating,
        fit_offset: r.fit_offset,
        width_rating: r.width_rating,
        user_height_cm: r.user_height_cm,
        user_weight_kg: r.user_weight_kg,
        user_foot_length_cm: r.user_foot_length_cm,
        created_at: r.created_at,
      })),
    };
  } catch (e) {
    console.error('[FitShift] exportUserData error:', e);
    return null;
  }
}

function importUserData(data) {
  try {
    if (!data || data.version !== 1) {
      return { error: 'Invalid or unsupported backup version' };
    }

    let shoesImported = 0;
    let reportsImported = 0;
    let profileImported = false;

    // Import profile
    if (data.userProfile) {
      const p = data.userProfile;
      getOrCreateProfile();
      updateProfile({
        heightCm: p.height_cm || null,
        weightKg: p.weight_kg || null,
        footLengthCm: p.foot_length_cm || null,
        footWidth: p.foot_width || null,
      });
      profileImported = true;
    }

    // Import user shoes — resolve brand/model names to IDs
    if (Array.isArray(data.userShoes)) {
      for (const shoe of data.userShoes) {
        const brand = getBrandByName(shoe.brand_name);
        if (!brand) continue;

        let modelId = null;
        if (shoe.model_name) {
          const models = getModelsByBrand(brand.id);
          const match = models.find((m) => m.name === shoe.model_name);
          if (match) modelId = match.id;
        }

        insertUserShoe(
          brand.id, modelId, shoe.gender,
          shoe.size_system, shoe.size_value, shoe.nickname
        );
        shoesImported++;
      }
    }

    // Import fit reports — resolve brand/model names to IDs
    if (Array.isArray(data.fitReports)) {
      for (const report of data.fitReports) {
        const refBrand = getBrandByName(report.ref_brand_name);
        const compBrand = getBrandByName(report.comp_brand_name);
        if (!refBrand || !compBrand) continue;

        const refModels = getModelsByBrand(refBrand.id);
        const compModels = getModelsByBrand(compBrand.id);
        const refModel = refModels.find((m) => m.name === report.ref_model_name);
        const compModel = compModels.find((m) => m.name === report.comp_model_name);
        if (!refModel || !compModel) continue;

        insertFitReport({
          referenceModelId: refModel.id,
          referenceSizeUs: report.reference_size_us,
          referenceGender: report.reference_gender,
          comparedModelId: compModel.id,
          comparedSizeUs: report.compared_size_us,
          comparedGender: report.compared_gender,
          fitRating: report.fit_rating,
          fitOffset: report.fit_offset || 0,
          widthRating: report.width_rating,
          userHeightCm: report.user_height_cm,
          userWeightKg: report.user_weight_kg,
          userFootLengthCm: report.user_foot_length_cm,
          source: 'user',
        });
        reportsImported++;
      }
    }

    return {
      success: true,
      shoesImported,
      reportsImported,
      profileImported,
    };
  } catch (e) {
    console.error('[FitShift] importUserData error:', e);
    return { error: 'Import failed: ' + e.message };
  }
}

function replaceUserData(data) {
  if (!data || data.version !== 1) {
    return { error: 'Invalid or unsupported backup version' };
  }
  db.run('DELETE FROM user_shoes');
  db.run('DELETE FROM user_fit_reports');
  db.run('DELETE FROM user_profiles');
  return importUserData(data);
}

// ---------------------------------------------------------------------------
// Replace all data from Supabase cloud
// ---------------------------------------------------------------------------

function replaceAllData(cloudData) {
  try {
    // Clear all local tables
    db.run('DELETE FROM user_shoes');
    db.run('DELETE FROM user_fit_reports');
    db.run('DELETE FROM seed_fit_reports');
    db.run('DELETE FROM scraped_reviews');
    db.run('DELETE FROM size_charts');
    db.run('DELETE FROM models');
    db.run('DELETE FROM brands');
    db.run('DELETE FROM user_profiles');

    // Insert brands with explicit IDs
    if (Array.isArray(cloudData.brands)) {
      for (const b of cloudData.brands) {
        db.run(
          'INSERT INTO brands (id, name, website_url, size_chart_url) VALUES (?, ?, ?, ?)',
          [b.id, b.name, b.website_url || null, b.size_chart_url || null]
        );
      }
    }

    // Insert models with explicit IDs
    if (Array.isArray(cloudData.models)) {
      for (const m of cloudData.models) {
        db.run(
          `INSERT INTO models (id, brand_id, name, category, model_family, version, year, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id, m.brand_id, m.name, m.category || null,
           m.model_family || m.name, m.version || null, m.year || null, m.is_active ?? 1]
        );
      }
    }

    // Insert size charts
    if (Array.isArray(cloudData.size_charts)) {
      for (const sc of cloudData.size_charts) {
        db.run(
          `INSERT INTO size_charts (id, brand_id, gender, us_size, uk_size, eu_size, cm_length)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [sc.id, sc.brand_id, sc.gender, sc.us_size, sc.uk_size || null, sc.eu_size || null, sc.cm_length || null]
        );
      }
    }

    // Insert seed fit reports
    if (Array.isArray(cloudData.seed_fit_reports)) {
      for (const r of cloudData.seed_fit_reports) {
        db.run(
          `INSERT INTO seed_fit_reports
             (id, reference_model_id, reference_size_us, reference_gender,
              compared_model_id, compared_size_us, compared_gender,
              fit_rating, fit_offset, width_rating,
              user_height_cm, user_weight_kg, user_foot_length_cm, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.reference_model_id, r.reference_size_us, r.reference_gender,
           r.compared_model_id, r.compared_size_us, r.compared_gender,
           r.fit_rating, r.fit_offset || 0, r.width_rating || 'true_to_width',
           r.user_height_cm || null, r.user_weight_kg || null, r.user_foot_length_cm || null,
           r.source || 'seed', r.created_at || null]
        );
      }
    }

    // Insert user shoes
    if (Array.isArray(cloudData.user_shoes)) {
      for (const s of cloudData.user_shoes) {
        db.run(
          `INSERT INTO user_shoes (id, brand_id, model_id, gender, size_system, size_value, nickname, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.brand_id, s.model_id || null, s.gender || 'mens',
           s.size_system || 'us', s.size_value, s.nickname || null, s.created_at || null]
        );
      }
    }

    // Insert user fit reports
    if (Array.isArray(cloudData.user_fit_reports)) {
      for (const r of cloudData.user_fit_reports) {
        db.run(
          `INSERT INTO user_fit_reports
             (id, reference_model_id, reference_size_us, reference_gender,
              compared_model_id, compared_size_us, compared_gender,
              fit_rating, fit_offset, width_rating,
              user_height_cm, user_weight_kg, user_foot_length_cm, source, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, r.reference_model_id, r.reference_size_us, r.reference_gender,
           r.compared_model_id, r.compared_size_us, r.compared_gender,
           r.fit_rating, r.fit_offset || 0, r.width_rating || 'true_to_width',
           r.user_height_cm || null, r.user_weight_kg || null, r.user_foot_length_cm || null,
           r.source || 'user', r.created_at || null]
        );
      }
    }

    // Insert user profile
    if (cloudData.user_profile) {
      const p = cloudData.user_profile;
      db.run(
        `INSERT INTO user_profiles (height_cm, weight_kg, foot_length_cm, foot_width, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [p.height_cm || null, p.weight_kg || null, p.foot_length_cm || null,
         p.foot_width || null, p.created_at || null]
      );
    }

    // Insert scraped reviews
    if (Array.isArray(cloudData.scraped_reviews)) {
      for (const sr of cloudData.scraped_reviews) {
        db.run(
          `INSERT INTO scraped_reviews
             (id, source_url, source_site, brand_name, model_name, raw_sizing_text,
              parsed_fit, parsed_offset, scraped_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sr.id, sr.source_url, sr.source_site, sr.brand_name || null,
           sr.model_name || null, sr.raw_sizing_text || null,
           sr.parsed_fit || null, sr.parsed_offset || null, sr.scraped_at || null]
        );
      }
    }

    return { success: true };
  } catch (e) {
    console.error('[FitShift] replaceAllData error:', e);
    return { error: 'replaceAllData failed: ' + e.message };
  }
}

// ---------------------------------------------------------------------------
// Database stats (for debugging)
// ---------------------------------------------------------------------------

function getStats() {
  try {
    const brandCount = db.exec('SELECT COUNT(*) FROM brands')[0]?.values[0][0] || 0;
    const modelCount = db.exec('SELECT COUNT(*) FROM models')[0]?.values[0][0] || 0;
    const sizeChartCount = db.exec('SELECT COUNT(*) FROM size_charts')[0]?.values[0][0] || 0;
    const seedFitCount = db.exec('SELECT COUNT(*) FROM seed_fit_reports')[0]?.values[0][0] || 0;
    const userFitCount = db.exec('SELECT COUNT(*) FROM user_fit_reports')[0]?.values[0][0] || 0;
    const fitReportCount = seedFitCount + userFitCount;
    const scrapedCount = db.exec('SELECT COUNT(*) FROM scraped_reviews')[0]?.values[0][0] || 0;
    const userShoeCount = db.exec('SELECT COUNT(*) FROM user_shoes')[0]?.values[0][0] || 0;
    return { brandCount, modelCount, sizeChartCount, fitReportCount, scrapedCount, userShoeCount };
  } catch (e) {
    console.error('[FitShift] getStats error:', e);
    return { brandCount: 0, modelCount: 0, sizeChartCount: 0, fitReportCount: 0, scrapedCount: 0, userShoeCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Conditional exports for testing (Node.js only)
// ---------------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SCHEMA_SQL,
    MIGRATION_SQL,
    FIT_REPORTS_MIGRATION_SQL,
    initDatabase,
    persist,
    insertBrand,
    getAllBrands,
    getBrandByName,
    insertModel,
    getModelsByBrand,
    getModelById,
    getModelsByFamily,
    searchModels,
    insertSizeChart,
    getSizeChart,
    convertSize,
    convertSizeFromSystem,
    getSizeOptions,
    insertFitReport,
    getFitReportsForModel,
    getFitSummary,
    getFitSummaryForFamily,
    getCrossModelFitData,
    getOrCreateProfile,
    updateProfile,
    insertUserShoe,
    getUserShoes,
    getUserShoeById,
    deleteUserShoe,
    insertScrapedReview,
    seedFromJSON,
    seedFitData,
    getModelFitConsensus,
    getStats,
    exportUserData,
    importUserData,
    replaceUserData,
    replaceAllData,
    // Test helpers
    _setDb(newDb) { db = newDb; },
    _setSql(newSql) { SQL = newSql; },
  };
}
