/**
 * SizeCompare — Scraper Coordinator
 *
 * Parses and normalizes scraped data received from content scripts.
 * Handles natural language fit descriptions → structured fit_rating + fit_offset.
 */

// ---------------------------------------------------------------------------
// Fit description parser
// ---------------------------------------------------------------------------

const FIT_PATTERNS = [
  // Exact matches first
  { pattern: /true to size/i, rating: 'true_to_size', offset: 0 },
  { pattern: /fits true/i, rating: 'true_to_size', offset: 0 },
  { pattern: /fits as expected/i, rating: 'true_to_size', offset: 0 },
  { pattern: /perfect fit/i, rating: 'true_to_size', offset: 0 },

  // Runs small patterns
  { pattern: /runs?\s+(a\s+)?full\s+size\s+small/i, rating: 'runs_small', offset: -1.0 },
  { pattern: /runs?\s+(a\s+)?half\s+size\s+small/i, rating: 'runs_small', offset: -0.5 },
  { pattern: /runs?\s+small/i, rating: 'runs_small', offset: -0.5 },
  { pattern: /size\s+up/i, rating: 'runs_small', offset: -0.5 },
  { pattern: /go\s+(a\s+)?(half\s+)?size\s+up/i, rating: 'runs_small', offset: -0.5 },
  { pattern: /narrow\s+fit/i, rating: 'runs_small', offset: -0.25 },
  { pattern: /tight\s+fit/i, rating: 'runs_small', offset: -0.5 },
  { pattern: /snug/i, rating: 'runs_small', offset: -0.25 },

  // Runs large patterns
  { pattern: /runs?\s+(a\s+)?full\s+size\s+large/i, rating: 'runs_large', offset: 1.0 },
  { pattern: /runs?\s+(a\s+)?half\s+size\s+large/i, rating: 'runs_large', offset: 0.5 },
  { pattern: /runs?\s+large/i, rating: 'runs_large', offset: 0.5 },
  { pattern: /runs?\s+big/i, rating: 'runs_large', offset: 0.5 },
  { pattern: /size\s+down/i, rating: 'runs_large', offset: 0.5 },
  { pattern: /go\s+(a\s+)?(half\s+)?size\s+down/i, rating: 'runs_large', offset: 0.5 },
  { pattern: /loose\s+fit/i, rating: 'runs_large', offset: 0.25 },
  { pattern: /roomy/i, rating: 'runs_large', offset: 0.25 },
];

function parseFitDescription(text) {
  if (!text) return null;

  for (const { pattern, rating, offset } of FIT_PATTERNS) {
    if (pattern.test(text)) {
      return { rating, offset };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Size chart data normalizer
// ---------------------------------------------------------------------------

function normalizeSizeChartData(rawData, brandName) {
  // Normalize scraped size chart data into our standard format
  // rawData: array of objects with varying key names
  if (!Array.isArray(rawData)) return [];

  return rawData.map((row) => {
    return {
      us: parseSize(row.us || row.US || row['US Size'] || row['US Men'] || row['US Women']),
      uk: parseSize(row.uk || row.UK || row['UK Size'] || row['UK']),
      eu: parseSize(row.eu || row.EU || row['EU Size'] || row['EUR'] || row['EU']),
      cm: parseSize(row.cm || row.CM || row['cm'] || row['Foot Length (cm)'] || row['CM']),
    };
  }).filter((row) => row.us !== null);
}

function parseSize(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// ---------------------------------------------------------------------------
// RunRepeat data extractor
// ---------------------------------------------------------------------------

function extractRunRepeatData(scrapedData) {
  // scrapedData: { url, brandName, modelName, sizingText, scores }
  const parsed = parseFitDescription(scrapedData.sizingText);

  return {
    sourceUrl: scrapedData.url,
    sourceSite: 'runrepeat',
    brandName: scrapedData.brandName,
    modelName: scrapedData.modelName,
    rawSizingText: scrapedData.sizingText,
    parsedFit: parsed?.rating || null,
    parsedOffset: parsed?.offset || null,
  };
}

// ---------------------------------------------------------------------------
// Brand name normalizer
// ---------------------------------------------------------------------------

const BRAND_ALIASES = {
  nike: 'Nike',
  'nike running': 'Nike',
  brooks: 'Brooks',
  'brooks running': 'Brooks',
  saucony: 'Saucony',
  asics: 'Asics',
  'asics running': 'Asics',
  adidas: 'Adidas',
  'adidas running': 'Adidas',
  hoka: 'HOKA',
  'hoka one one': 'HOKA',
  'hoka running': 'HOKA',
  on: 'On Running',
  'on running': 'On Running',
  'on-running': 'On Running',
  'under armour': 'Under Armour',
  'under armor': 'Under Armour',
  ua: 'Under Armour',
  'new balance': 'New Balance',
  'new balance running': 'New Balance',
  nb: 'New Balance',
  puma: 'Puma',
  'puma running': 'Puma',
};

function normalizeBrandName(raw) {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return BRAND_ALIASES[lower] || raw.trim();
}

// ---------------------------------------------------------------------------
// Model version parser
// ---------------------------------------------------------------------------

function parseModelVersion(fullName) {
  if (!fullName) return { family: fullName, version: null, displayName: fullName };

  const trimmed = fullName.trim();

  // "Air Zoom Pegasus 41" → { family: "Air Zoom Pegasus", version: "41" }
  // "Gel-Nimbus 26"       → { family: "Gel-Nimbus", version: "26" }
  // "Ghost 16"            → { family: "Ghost", version: "16" }
  // "Ghost"               → { family: "Ghost", version: null }
  // "GT-2000 13"          → { family: "GT-2000", version: "13" }
  const match = trimmed.match(/^(.+?)\s+(\d+)$/);
  if (match) {
    return {
      family: match[1].trim(),
      version: match[2],
      displayName: trimmed,
    };
  }

  return { family: trimmed, version: null, displayName: trimmed };
}
