/**
 * FitShift — Popup Logic
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

const SYSTEM_LABELS = { us: 'US', uk: 'UK', eu: 'EU' };

// Format a saved shoe for dropdown display
function formatShoeLabel(shoe) {
  const sysLabel = SYSTEM_LABELS[shoe.size_system] || 'US';
  const genderLabel = shoe.gender === 'womens' ? "Women's" : "Men's";
  const sizeStr = `${sysLabel} ${shoe.size_value} ${genderLabel}`;

  if (shoe.nickname) {
    return `${shoe.nickname} (${shoe.brand_name} ${sizeStr})`;
  }
  const modelStr = shoe.model_name || '';
  if (modelStr) {
    return `${shoe.brand_name} ${modelStr} - ${sizeStr}`;
  }
  return `${shoe.brand_name} - ${sizeStr}`;
}

// Fallback size ranges when no brand-specific data is available yet
const FALLBACK_SIZES = {
  us:  { min: 4, max: 16, step: 0.5 },
  uk:  { min: 3, max: 15, step: 0.5 },
  eu:  { min: 35.5, max: 51.5, step: 0.5 },
};

// Populate a size select — tries brand-specific sizes first, falls back to generic range
async function populateSizeSelect(select, brandId, gender, system) {
  select.innerHTML = '<option value="">Size...</option>';

  let sizes = null;
  if (brandId) {
    const response = await sendMessage({
      type: 'GET_SIZE_OPTIONS',
      brandId: parseInt(brandId),
      gender: gender || 'mens',
      sizeSystem: system || 'us',
    });
    sizes = response?.data;
  }

  if (sizes && sizes.length > 0) {
    for (const s of sizes) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      select.appendChild(opt);
    }
  } else {
    // Generic fallback
    const range = FALLBACK_SIZES[system] || FALLBACK_SIZES.us;
    for (let s = range.min; s <= range.max; s += range.step) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = system === 'eu' ? s.toFixed(1).replace('.0', '') : s;
      select.appendChild(opt);
    }
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
    // Show version in dropdown label if available
    let label = model.name;
    if (model.version && model.model_family) {
      label = `${model.model_family} v${model.version}`;
    }
    opt.textContent = label;
    opt.dataset.family = model.model_family || model.name;
    opt.dataset.brandId = brandId;
    select.appendChild(opt);
  }
  select.disabled = false;
}

// ---------------------------------------------------------------------------
// Compare tab — current shoe dropdown
// ---------------------------------------------------------------------------

let userShoesCache = null;

async function loadUserShoes() {
  const response = await sendMessage({ type: 'GET_USER_SHOES' });
  userShoesCache = response?.data || [];
  return userShoesCache;
}

function populateRefShoeDropdown(shoes) {
  const select = $('#ref-shoe');
  const emptyState = $('#ref-shoe-empty');
  select.innerHTML = '<option value="">Select a saved shoe...</option>';

  if (!shoes || shoes.length === 0) {
    select.classList.add('hidden');
    emptyState.classList.remove('hidden');
    $('#btn-compare').disabled = true;
    return;
  }

  emptyState.classList.add('hidden');
  select.classList.remove('hidden');

  for (const shoe of shoes) {
    const opt = document.createElement('option');
    opt.value = shoe.id;
    opt.textContent = formatShoeLabel(shoe);
    opt.dataset.brandId = shoe.brand_id;
    opt.dataset.modelId = shoe.model_id || '';
    opt.dataset.gender = shoe.gender;
    opt.dataset.sizeSystem = shoe.size_system;
    opt.dataset.sizeValue = shoe.size_value;
    opt.dataset.modelFamily = shoe.model_family || shoe.model_name || '';
    select.appendChild(opt);
  }
}

$('#ref-shoe').addEventListener('change', (e) => {
  const opt = e.target.selectedOptions[0];
  if (!opt || !opt.value) {
    $('#ref-brand').value = '';
    $('#ref-model').value = '';
    $('#ref-gender').value = 'mens';
    $('#ref-system').value = 'us';
    $('#ref-size').value = '';
    updateCompareButton();
    return;
  }
  $('#ref-brand').value = opt.dataset.brandId;
  $('#ref-model').value = opt.dataset.modelId;
  $('#ref-gender').value = opt.dataset.gender;
  $('#ref-system').value = opt.dataset.sizeSystem;
  $('#ref-size').value = opt.dataset.sizeValue;
  updateCompareButton();
});

// "Add shoe" links navigate to Profile tab and open the add form
function handleAddShoeLink(e) {
  e.preventDefault();
  $$('.tab').forEach((t) => t.classList.remove('active'));
  $$('.tab-content').forEach((c) => c.classList.remove('active'));
  $('[data-tab="profile"]').classList.add('active');
  $('#tab-profile').classList.add('active');
  $('#add-shoe-form').classList.remove('hidden');
  $('#btn-show-add-shoe').classList.add('hidden');
}

$('#link-add-shoe').addEventListener('click', handleAddShoeLink);
$('#link-add-shoe-empty').addEventListener('click', handleAddShoeLink);

async function refreshAllShoeUI() {
  const shoes = await loadUserShoes();
  renderShoeList(shoes);
  populateRefShoeDropdown(shoes);
  populateReportRefShoeDropdown(shoes);
  populateReportCompShoeDropdown(shoes);
}

// ---------------------------------------------------------------------------
// Compare tab logic
// ---------------------------------------------------------------------------

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
  const sizeSystem = $('#ref-system').value;
  const refModelId = $('#ref-model').value ? parseInt($('#ref-model').value) : null;
  const compModelId = $('#comp-model').value ? parseInt($('#comp-model').value) : null;

  // 1. Size chart conversion — pass selected system
  const convResponse = await sendMessage({
    type: 'CONVERT_SIZE',
    fromBrandId: refBrandId,
    toBrandId: compBrandId,
    gender,
    sizeValue: refSize,
    sizeSystem,
  });

  const conversion = convResponse?.data;
  const sizeDiv = $('#size-conversion');
  const sysLabel = SYSTEM_LABELS[sizeSystem] || 'US';

  if (conversion) {
    // Highlight the user's chosen system as the primary result
    const primarySize = conversion[sizeSystem === 'uk' ? 'uk_size' : sizeSystem === 'eu' ? 'eu_size' : 'us_size'];
    const primaryLabel = sysLabel;

    sizeDiv.innerHTML = `
      <div class="label">Equivalent size (based on foot length)</div>
      <div class="value">${primaryLabel} ${primarySize}</div>
      <div class="detail">
        US ${conversion.us_size} | UK ${conversion.uk_size || '—'} | EU ${conversion.eu_size || '—'} | ${conversion.cm_length || '—'} cm
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

    let fitResult = fitResponse?.data || { length: [], width: [] };
    let fitData = fitResult.length || [];
    let widthData = fitResult.width || [];
    let dataSource = 'version-specific';

    // Auto-fallback: if fewer than 3 reports for this version, try family-level
    const total = fitData.reduce((sum, r) => sum + r.count, 0);
    if (total < 3) {
      const compOpt = $('#comp-model').selectedOptions[0];
      const compFamily = compOpt?.dataset?.family;
      if (compFamily) {
        const familyResponse = await sendMessage({
          type: 'GET_FIT_SUMMARY_FAMILY',
          referenceModelId: refModelId,
          comparedModelFamily: compFamily,
          comparedBrandId: compBrandId,
        });
        const familyResult = familyResponse?.data || { length: [], width: [] };
        const familyData = familyResult.length || [];
        const familyTotal = familyData.reduce((sum, r) => sum + r.count, 0);
        if (familyTotal > total) {
          fitData = familyData;
          widthData = familyResult.width || [];
          dataSource = 'family';
        }
      }
    }

    const displayTotal = fitData.reduce((sum, r) => sum + r.count, 0);
    if (displayTotal > 0) {
      const tts = fitData.find((r) => r.fit_rating === 'true_to_size');
      const small = fitData.find((r) => r.fit_rating === 'runs_small');
      const large = fitData.find((r) => r.fit_rating === 'runs_large');
      const sourceLabel = dataSource === 'family'
        ? `<span class="fallback-note">(across all versions)</span>`
        : '';

      // Width bars
      const widthTotal = widthData.reduce((sum, r) => sum + r.count, 0);
      const ttw = widthData.find((r) => r.width_rating === 'true_to_width');
      const narrow = widthData.find((r) => r.width_rating === 'too_narrow');
      const wide = widthData.find((r) => r.width_rating === 'too_wide');

      let widthHtml = '';
      if (widthTotal > 0) {
        widthHtml = `
          <div class="fit-section-heading">Width</div>
          <div class="fit-bar-container">
            ${fitBarRow('Good fit', ttw?.count || 0, widthTotal, 'ttw')}
            ${fitBarRow('Too narrow', narrow?.count || 0, widthTotal, 'narrow')}
            ${fitBarRow('Too wide', wide?.count || 0, widthTotal, 'wide')}
          </div>
        `;
      }

      fitDiv.innerHTML = `
        <div class="label">Crowdsourced fit data (${displayTotal} reports) ${sourceLabel}</div>
        <div class="fit-section-heading">Length</div>
        <div class="fit-bar-container">
          ${fitBarRow('Good fit', tts?.count || 0, displayTotal, 'tts')}
          ${fitBarRow('Too small', small?.count || 0, displayTotal, 'small')}
          ${fitBarRow('Too large', large?.count || 0, displayTotal, 'large')}
        </div>
        <div class="detail">
          Average offset: ${averageOffset(fitData)} sizes
        </div>
        ${widthHtml}
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
// Report tab — manual entry toggle
// ---------------------------------------------------------------------------

$$('.toggle-manual').forEach((divider) => {
  divider.addEventListener('click', () => {
    const target = $(`#${divider.dataset.target}`);
    const isOpen = !target.classList.contains('hidden');
    if (isOpen) {
      target.classList.add('hidden');
      divider.classList.remove('open');
      divider.querySelector('span').innerHTML = 'or enter manually &#9662;';
    } else {
      target.classList.remove('hidden');
      divider.classList.add('open');
      divider.querySelector('span').innerHTML = 'or enter manually &#9652;';
    }
  });
});

// ---------------------------------------------------------------------------
// Report tab — saved shoe quick-select (reference side)
// ---------------------------------------------------------------------------

function populateReportRefShoeDropdown(shoes) {
  const select = $('#report-ref-shoe');
  select.innerHTML = '<option value="">Select a saved shoe...</option>';

  if (!shoes || shoes.length === 0) return;

  for (const shoe of shoes) {
    const opt = document.createElement('option');
    opt.value = shoe.id;
    opt.textContent = formatShoeLabel(shoe);
    opt.dataset.brandId = shoe.brand_id;
    opt.dataset.modelId = shoe.model_id || '';
    opt.dataset.gender = shoe.gender;
    opt.dataset.sizeSystem = shoe.size_system;
    opt.dataset.sizeValue = shoe.size_value;
    select.appendChild(opt);
  }
}

function populateReportCompShoeDropdown(shoes) {
  const select = $('#report-comp-shoe');
  select.innerHTML = '<option value="">Select a saved shoe...</option>';

  if (!shoes || shoes.length === 0) return;

  for (const shoe of shoes) {
    const opt = document.createElement('option');
    opt.value = shoe.id;
    opt.textContent = formatShoeLabel(shoe);
    opt.dataset.brandId = shoe.brand_id;
    opt.dataset.modelId = shoe.model_id || '';
    opt.dataset.gender = shoe.gender;
    opt.dataset.sizeSystem = shoe.size_system;
    opt.dataset.sizeValue = shoe.size_value;
    select.appendChild(opt);
  }
}

$('#report-ref-shoe').addEventListener('change', async (e) => {
  const opt = e.target.selectedOptions[0];
  if (!opt || !opt.value) return;

  const brandId = opt.dataset.brandId;
  const modelId = opt.dataset.modelId;
  const gender = opt.dataset.gender;
  const sizeSystem = opt.dataset.sizeSystem;
  const sizeValue = opt.dataset.sizeValue;

  $('#report-ref-brand').value = brandId;
  await populateModelSelect('#report-ref-model', brandId);
  if (modelId) $('#report-ref-model').value = modelId;
  $('#report-ref-gender').value = gender;
  $('#report-ref-system').value = sizeSystem;
  await populateSizeSelect($('#report-ref-size'), brandId, gender, sizeSystem);
  $('#report-ref-size').value = sizeValue;
});

$('#report-comp-shoe').addEventListener('change', async (e) => {
  const opt = e.target.selectedOptions[0];
  if (!opt || !opt.value) return;

  const brandId = opt.dataset.brandId;
  const modelId = opt.dataset.modelId;
  const gender = opt.dataset.gender;
  const sizeSystem = opt.dataset.sizeSystem;
  const sizeValue = opt.dataset.sizeValue;

  $('#report-comp-brand').value = brandId;
  await populateModelSelect('#report-comp-model', brandId);
  if (modelId) $('#report-comp-model').value = modelId;
  $('#report-comp-gender').value = gender;
  $('#report-comp-system').value = sizeSystem;
  await populateSizeSelect($('#report-comp-size'), brandId, gender, sizeSystem);
  $('#report-comp-size').value = sizeValue;
});

// Clear saved shoe dropdown when manual fields change
['#report-ref-brand', '#report-ref-model', '#report-ref-gender', '#report-ref-system', '#report-ref-size'].forEach((sel) => {
  $(sel).addEventListener('change', () => {
    if (document.activeElement !== $('#report-ref-shoe')) {
      $('#report-ref-shoe').value = '';
    }
  });
});

['#report-comp-brand', '#report-comp-model', '#report-comp-gender', '#report-comp-system', '#report-comp-size'].forEach((sel) => {
  $(sel).addEventListener('change', () => {
    if (document.activeElement !== $('#report-comp-shoe')) {
      $('#report-comp-shoe').value = '';
    }
  });
});

// ---------------------------------------------------------------------------
// Report tab — size system refresh helpers
// ---------------------------------------------------------------------------

async function refreshReportRefSizes() {
  const brandId = $('#report-ref-brand').value;
  const gender = $('#report-ref-gender').value;
  const system = $('#report-ref-system').value;
  await populateSizeSelect($('#report-ref-size'), brandId, gender, system);
}

async function refreshReportCompSizes() {
  const brandId = $('#report-comp-brand').value;
  const gender = $('#report-comp-gender').value;
  const system = $('#report-comp-system').value;
  await populateSizeSelect($('#report-comp-size'), brandId, gender, system);
}

// ---------------------------------------------------------------------------
// Report tab logic
// ---------------------------------------------------------------------------

$('#report-ref-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#report-ref-model', e.target.value);
  await refreshReportRefSizes();
});

$('#report-ref-gender').addEventListener('change', refreshReportRefSizes);
$('#report-ref-system').addEventListener('change', refreshReportRefSizes);

$('#report-comp-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#report-comp-model', e.target.value);
  await refreshReportCompSizes();
});

$('#report-comp-gender').addEventListener('change', refreshReportCompSizes);
$('#report-comp-system').addEventListener('change', refreshReportCompSizes);

// Length fit buttons — only toggle within their own group
$$('.length-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.length-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// Width fit buttons — only toggle within their own group
$$('.width-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.width-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

// Initial fallback size populations (will refresh when brand is chosen)
populateSizeSelect($('#report-ref-size'), null, 'mens', 'us');
populateSizeSelect($('#report-comp-size'), null, 'mens', 'us');

$('#btn-submit-report').addEventListener('click', async () => {
  const refModelId = $('#report-ref-model').value;
  const refSize = $('#report-ref-size').value;
  const refGender = $('#report-ref-gender').value;
  const refSystem = $('#report-ref-system').value;
  const refBrandId = $('#report-ref-brand').value;
  const compModelId = $('#report-comp-model').value;
  const compSize = $('#report-comp-size').value;
  const compGender = $('#report-comp-gender').value;
  const compSystem = $('#report-comp-system').value;
  const compBrandId = $('#report-comp-brand').value;
  const lengthBtn = $('.length-btn.selected');
  const widthBtn = $('.width-btn.selected');

  if (!refModelId || !refSize || !compModelId || !compSize || !lengthBtn || !widthBtn) {
    showStatus('#report-status', 'Please fill in all fields.', 'error');
    return;
  }

  // Convert sizes to US for storage if entered in a different system
  let refSizeUs = parseFloat(refSize);
  if (refSystem !== 'us' && refBrandId) {
    const conv = await sendMessage({
      type: 'CONVERT_SIZE',
      fromBrandId: parseInt(refBrandId),
      toBrandId: parseInt(refBrandId),
      gender: refGender,
      sizeValue: parseFloat(refSize),
      sizeSystem: refSystem,
    });
    if (conv?.data?.us_size) refSizeUs = conv.data.us_size;
  }

  let compSizeUs = parseFloat(compSize);
  if (compSystem !== 'us' && compBrandId) {
    const conv = await sendMessage({
      type: 'CONVERT_SIZE',
      fromBrandId: parseInt(compBrandId),
      toBrandId: parseInt(compBrandId),
      gender: compGender,
      sizeValue: parseFloat(compSize),
      sizeSystem: compSystem,
    });
    if (conv?.data?.us_size) compSizeUs = conv.data.us_size;
  }

  const report = {
    referenceModelId: parseInt(refModelId),
    referenceSizeUs: refSizeUs,
    referenceGender: refGender,
    comparedModelId: parseInt(compModelId),
    comparedSizeUs: compSizeUs,
    comparedGender: compGender,
    fitRating: lengthBtn.dataset.fit,
    fitOffset: parseFloat(lengthBtn.dataset.offset),
    widthRating: widthBtn.dataset.width,
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
      Scraped reviews: ${s.scrapedCount}<br>
      Saved shoes: ${s.userShoeCount}
    `;
  }
}

// ---------------------------------------------------------------------------
// My Shoes — Profile tab shoe management
// ---------------------------------------------------------------------------

function renderShoeList(shoes) {
  const listEl = $('#my-shoes-list');
  const emptyEl = $('#my-shoes-empty');

  if (!shoes || shoes.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.innerHTML = shoes.map((shoe) => `
    <div class="shoe-item" data-shoe-id="${shoe.id}">
      <div class="shoe-item-info">
        <span class="shoe-item-name">${formatShoeLabel(shoe)}</span>
      </div>
      <button class="btn-delete-shoe" data-shoe-id="${shoe.id}" title="Remove shoe">&times;</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.btn-delete-shoe').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const shoeId = parseInt(e.target.dataset.shoeId);
      await sendMessage({ type: 'DELETE_USER_SHOE', shoeId });
      await refreshAllShoeUI();
    });
  });
}

// Add shoe form toggle
$('#btn-show-add-shoe').addEventListener('click', () => {
  $('#add-shoe-form').classList.remove('hidden');
  $('#btn-show-add-shoe').classList.add('hidden');
});

$('#btn-cancel-shoe').addEventListener('click', () => {
  $('#add-shoe-form').classList.add('hidden');
  $('#btn-show-add-shoe').classList.remove('hidden');
  resetAddShoeForm();
});

function resetAddShoeForm() {
  $('#shoe-brand').value = '';
  $('#shoe-model').innerHTML = '<option value="">Select model...</option>';
  $('#shoe-model').disabled = true;
  $('#shoe-gender').value = 'mens';
  $('#shoe-system').value = 'us';
  $('#shoe-size').innerHTML = '<option value="">Size...</option>';
  $('#shoe-size').disabled = true;
  $('#shoe-nickname').value = '';
}

// Add shoe form — brand/model/size population
$('#shoe-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#shoe-model', e.target.value);
  await refreshAddShoeSizes();
});

$('#shoe-gender').addEventListener('change', refreshAddShoeSizes);
$('#shoe-system').addEventListener('change', refreshAddShoeSizes);

async function refreshAddShoeSizes() {
  const brandId = $('#shoe-brand').value;
  const gender = $('#shoe-gender').value;
  const system = $('#shoe-system').value;
  await populateSizeSelect($('#shoe-size'), brandId, gender, system);
  $('#shoe-size').disabled = !brandId;
}

// Save shoe
$('#btn-save-shoe').addEventListener('click', async () => {
  const brandId = $('#shoe-brand').value;
  const modelId = $('#shoe-model').value;
  const gender = $('#shoe-gender').value;
  const sizeSystem = $('#shoe-system').value;
  const sizeValue = $('#shoe-size').value;
  const nickname = $('#shoe-nickname').value.trim();

  if (!brandId || !sizeValue) {
    showStatus('#shoe-status', 'Please select a brand and size.', 'error');
    return;
  }

  const response = await sendMessage({
    type: 'ADD_USER_SHOE',
    brandId: parseInt(brandId),
    modelId: modelId ? parseInt(modelId) : null,
    gender,
    sizeSystem,
    sizeValue: parseFloat(sizeValue),
    nickname: nickname || null,
  });

  if (response?.success) {
    showStatus('#shoe-status', 'Shoe saved!', 'success');
    $('#add-shoe-form').classList.add('hidden');
    $('#btn-show-add-shoe').classList.remove('hidden');
    resetAddShoeForm();
    await refreshAllShoeUI();
  } else {
    showStatus('#shoe-status', 'Error saving shoe.', 'error');
  }
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function init() {
  // Populate all brand selects
  await Promise.all([
    populateBrandSelect('#comp-brand'),
    populateBrandSelect('#report-ref-brand'),
    populateBrandSelect('#report-comp-brand'),
    populateBrandSelect('#shoe-brand'),
  ]);

  // Load profile, stats, and user shoes
  await loadProfile();
  await loadStats();
  await refreshAllShoeUI();
}

init();
