/**
 * SizeCompare — Popup Logic
 *
 * Handles all user interactions in the extension popup.
 * Communicates with the service worker via chrome.runtime.sendMessage.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return document.querySelectorAll(selector);
}

// Generate US size options (4–16 with half sizes)
function populateSizeSelect(select) {
  select.innerHTML = '<option value="">Size...</option>';
  for (let s = 4; s <= 16; s += 0.5) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  }
}

function showStatus(elementId, message, type) {
  const el = $(elementId);
  el.textContent = message;
  el.className = `status ${type}`;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ---------------------------------------------------------------------------
// Tab navigation
// ---------------------------------------------------------------------------

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.remove('active'));
    $$('.tab-content').forEach((c) => c.classList.remove('active'));
    tab.classList.add('active');
    $(`#tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ---------------------------------------------------------------------------
// Brand & model loading
// ---------------------------------------------------------------------------

let brandsCache = null;

async function loadBrands() {
  if (brandsCache) return brandsCache;
  const response = await sendMessage({ type: 'GET_BRANDS' });
  if (!response?.data?.length) return [];

  // sql.js returns { columns: [...], values: [[...], ...] }
  const result = response.data[0];
  brandsCache = result.values.map((row) => {
    const obj = {};
    result.columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
  return brandsCache;
}

async function populateBrandSelect(selectId) {
  const select = $(selectId);
  const brands = await loadBrands();
  select.innerHTML = '<option value="">Select brand...</option>';
  for (const brand of brands) {
    const opt = document.createElement('option');
    opt.value = brand.id;
    opt.textContent = brand.name;
    select.appendChild(opt);
  }
}

async function loadModels(brandId) {
  const response = await sendMessage({ type: 'GET_MODELS', brandId: parseInt(brandId) });
  return response?.data || [];
}

async function populateModelSelect(selectId, brandId) {
  const select = $(selectId);
  select.innerHTML = '<option value="">Select model...</option>';
  select.disabled = !brandId;
  if (!brandId) return;

  const models = await loadModels(brandId);
  for (const model of models) {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = model.name;
    select.appendChild(opt);
  }
  select.disabled = false;
}

// ---------------------------------------------------------------------------
// Compare tab logic
// ---------------------------------------------------------------------------

$('#ref-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#ref-model', e.target.value);
  updateCompareButton();
  if (e.target.value) {
    populateSizeSelect($('#ref-size'));
    $('#ref-size').disabled = false;
  } else {
    $('#ref-size').disabled = true;
  }
});

$('#ref-model').addEventListener('change', updateCompareButton);
$('#ref-size').addEventListener('change', updateCompareButton);
$('#ref-gender').addEventListener('change', updateCompareButton);

$('#comp-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#comp-model', e.target.value);
  updateCompareButton();
});

$('#comp-model').addEventListener('change', updateCompareButton);

function updateCompareButton() {
  const refBrand = $('#ref-brand').value;
  const refSize = $('#ref-size').value;
  const compBrand = $('#comp-brand').value;
  $('#btn-compare').disabled = !(refBrand && refSize && compBrand);
}

$('#btn-compare').addEventListener('click', async () => {
  const refBrandId = parseInt($('#ref-brand').value);
  const compBrandId = parseInt($('#comp-brand').value);
  const gender = $('#ref-gender').value;
  const refSize = parseFloat($('#ref-size').value);
  const refModelId = $('#ref-model').value ? parseInt($('#ref-model').value) : null;
  const compModelId = $('#comp-model').value ? parseInt($('#comp-model').value) : null;

  // 1. Size chart conversion
  const convResponse = await sendMessage({
    type: 'CONVERT_SIZE',
    fromBrandId: refBrandId,
    toBrandId: compBrandId,
    gender,
    fromUsSize: refSize,
  });

  const conversion = convResponse?.data;
  const sizeDiv = $('#size-conversion');

  if (conversion) {
    sizeDiv.innerHTML = `
      <div class="label">Equivalent size (based on foot length)</div>
      <div class="value">US ${conversion.us_size}</div>
      <div class="detail">
        UK ${conversion.uk_size || '—'} | EU ${conversion.eu_size || '—'} | ${conversion.cm_length || '—'} cm
      </div>
    `;
  } else {
    sizeDiv.innerHTML = `
      <div class="label">Size conversion</div>
      <div class="detail">No size chart data available for this combination.</div>
    `;
  }

  // 2. Crowdsourced fit data (if models selected)
  const fitDiv = $('#fit-data');

  if (refModelId && compModelId) {
    const fitResponse = await sendMessage({
      type: 'GET_FIT_SUMMARY',
      referenceModelId: refModelId,
      comparedModelId: compModelId,
    });

    const fitData = fitResponse?.data || [];
    if (fitData.length > 0) {
      const total = fitData.reduce((sum, r) => sum + r.count, 0);
      const tts = fitData.find((r) => r.fit_rating === 'true_to_size');
      const small = fitData.find((r) => r.fit_rating === 'runs_small');
      const large = fitData.find((r) => r.fit_rating === 'runs_large');

      fitDiv.innerHTML = `
        <div class="label">Crowdsourced fit data (${total} reports)</div>
        <div class="fit-bar-container">
          ${fitBarRow('True to size', tts?.count || 0, total, 'tts')}
          ${fitBarRow('Runs small', small?.count || 0, total, 'small')}
          ${fitBarRow('Runs large', large?.count || 0, total, 'large')}
        </div>
        <div class="detail">
          Average offset: ${averageOffset(fitData)} sizes
        </div>
      `;
    } else {
      fitDiv.innerHTML = `
        <div class="label">Crowdsourced fit data</div>
        <div class="detail">No fit reports yet for this combination. Be the first to report!</div>
      `;
    }
  } else {
    fitDiv.innerHTML = `
      <div class="label">Crowdsourced fit data</div>
      <div class="detail">Select specific models above to see community fit data.</div>
    `;
  }

  $('#compare-results').classList.remove('hidden');
});

function fitBarRow(label, count, total, cssClass) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div class="fit-bar-row">
      <span class="fit-bar-label">${label}</span>
      <div class="fit-bar">
        <div class="fit-bar-fill ${cssClass}" style="width: ${pct}%"></div>
      </div>
      <span class="fit-bar-count">${count}</span>
    </div>
  `;
}

function averageOffset(fitData) {
  const total = fitData.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return '0';
  const weighted = fitData.reduce((sum, r) => sum + (r.avg_offset || 0) * r.count, 0);
  const avg = weighted / total;
  return avg > 0 ? `+${avg.toFixed(1)}` : avg.toFixed(1);
}

// ---------------------------------------------------------------------------
// Report tab logic
// ---------------------------------------------------------------------------

$('#report-ref-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#report-ref-model', e.target.value);
});

$('#report-comp-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#report-comp-model', e.target.value);
});

// Fit buttons
$$('.fit-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.fit-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// Populate size selects for report tab
populateSizeSelect($('#report-ref-size'));
populateSizeSelect($('#report-comp-size'));

$('#btn-submit-report').addEventListener('click', async () => {
  const refModelId = $('#report-ref-model').value;
  const refSize = $('#report-ref-size').value;
  const refGender = $('#report-ref-gender').value;
  const compModelId = $('#report-comp-model').value;
  const compSize = $('#report-comp-size').value;
  const compGender = $('#report-comp-gender').value;
  const fitBtn = $('.fit-btn.selected');

  if (!refModelId || !refSize || !compModelId || !compSize || !fitBtn) {
    showStatus('#report-status', 'Please fill in all fields.', 'error');
    return;
  }

  const report = {
    referenceModelId: parseInt(refModelId),
    referenceSizeUs: parseFloat(refSize),
    referenceGender: refGender,
    comparedModelId: parseInt(compModelId),
    comparedSizeUs: parseFloat(compSize),
    comparedGender: compGender,
    fitRating: fitBtn.dataset.fit,
    fitOffset: parseFloat(fitBtn.dataset.offset),
    source: 'user',
  };

  // Include profile data if available
  const profileResponse = await sendMessage({ type: 'GET_PROFILE' });
  if (profileResponse?.data) {
    report.userHeightCm = profileResponse.data.height_cm;
    report.userWeightKg = profileResponse.data.weight_kg;
    report.userFootLengthCm = profileResponse.data.foot_length_cm;
  }

  const response = await sendMessage({ type: 'SUBMIT_FIT_REPORT', report });

  if (response?.success) {
    showStatus('#report-status', 'Fit report submitted! Thanks for contributing.', 'success');
  } else {
    showStatus('#report-status', 'Error submitting report. Please try again.', 'error');
  }
});

// ---------------------------------------------------------------------------
// Profile tab logic
// ---------------------------------------------------------------------------

async function loadProfile() {
  const response = await sendMessage({ type: 'GET_PROFILE' });
  if (response?.data) {
    const p = response.data;
    if (p.height_cm) $('#profile-height').value = p.height_cm;
    if (p.weight_kg) $('#profile-weight').value = p.weight_kg;
    if (p.foot_length_cm) $('#profile-foot-length').value = p.foot_length_cm;
    if (p.foot_width) $('#profile-foot-width').value = p.foot_width;
  }
}

$('#btn-save-profile').addEventListener('click', async () => {
  const profile = {
    heightCm: parseFloat($('#profile-height').value) || null,
    weightKg: parseFloat($('#profile-weight').value) || null,
    footLengthCm: parseFloat($('#profile-foot-length').value) || null,
    footWidth: $('#profile-foot-width').value || null,
  };

  const response = await sendMessage({ type: 'UPDATE_PROFILE', profile });

  if (response?.success) {
    showStatus('#profile-status', 'Profile saved.', 'success');
  } else {
    showStatus('#profile-status', 'Error saving profile.', 'error');
  }
});

async function loadStats() {
  const response = await sendMessage({ type: 'GET_STATS' });
  if (response?.data) {
    const s = response.data;
    $('#stats-content').innerHTML = `
      Brands: ${s.brandCount}<br>
      Models: ${s.modelCount}<br>
      Size chart entries: ${s.sizeChartCount}<br>
      Fit reports: ${s.fitReportCount}<br>
      Scraped reviews: ${s.scrapedCount}
    `;
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function init() {
  // Populate all brand selects
  await Promise.all([
    populateBrandSelect('#ref-brand'),
    populateBrandSelect('#comp-brand'),
    populateBrandSelect('#report-ref-brand'),
    populateBrandSelect('#report-comp-brand'),
  ]);

  // Load profile and stats
  await loadProfile();
  await loadStats();
}

init();
