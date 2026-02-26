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
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Service worker did not respond within 10 seconds'));
    }, 10000);

    try {
      chrome.runtime.sendMessage(msg, (response) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
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
  // Reset with a safe default option
  select.textContent = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Size...';
  select.appendChild(defaultOpt);

  let sizes = null;
  if (brandId) {
    try {
      const response = await sendMessage({
        type: 'GET_SIZE_OPTIONS',
        brandId: parseInt(brandId),
        gender: gender || 'mens',
        sizeSystem: system || 'us',
      });
      sizes = response?.data;
    } catch (e) {
      console.error('[FitShift] Failed to load size options:', e);
    }
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
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => el.classList.add('hidden'), 5000);
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
  try {
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
  } catch (e) {
    console.error('[FitShift] Failed to load brands:', e);
    return [];
  }
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
  try {
    const response = await sendMessage({ type: 'GET_MODELS', brandId: parseInt(brandId) });
    return response?.data || [];
  } catch (e) {
    console.error('[FitShift] Failed to load models:', e);
    return [];
  }
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
  try {
    const response = await sendMessage({ type: 'GET_USER_SHOES' });
    userShoesCache = response?.data || [];
  } catch (e) {
    console.error('[FitShift] Failed to load user shoes:', e);
    userShoesCache = [];
  }
  return userShoesCache;
}

function populateRefShoeDropdown(shoes) {
  const select = $('#ref-shoe');
  const emptyState = $('#ref-shoe-empty');
  select.textContent = '';
  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = 'Select a saved shoe...';
  select.appendChild(defaultOpt);

  if (!shoes || shoes.length === 0) {
    select.classList.add('hidden');
    emptyState.classList.remove('hidden');
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

$('#ref-shoe').addEventListener('change', async (e) => {
  const opt = e.target.selectedOptions[0];
  if (!opt || !opt.value) {
    $('#ref-brand').value = '';
    $('#ref-model').value = '';
    $('#ref-gender').value = 'mens';
    $('#ref-system').value = 'us';
    $('#ref-size').value = '';
    // Reset manual fields
    $('#ref-brand-manual').value = '';
    const modelSelect = $('#ref-model-manual');
    modelSelect.textContent = '';
    const defaultModelOpt = document.createElement('option');
    defaultModelOpt.value = '';
    defaultModelOpt.textContent = 'Select model...';
    modelSelect.appendChild(defaultModelOpt);
    modelSelect.disabled = true;
    $('#ref-gender-manual').value = 'mens';
    $('#ref-system-manual').value = 'us';
    await populateSizeSelect($('#ref-size-manual'), null, 'mens', 'us');
    updateCompareButton();
    return;
  }
  const brandId = opt.dataset.brandId;
  const modelId = opt.dataset.modelId;
  const gender = opt.dataset.gender;
  const sizeSystem = opt.dataset.sizeSystem;
  const sizeValue = opt.dataset.sizeValue;

  // Sync hidden fields
  $('#ref-brand').value = brandId;
  $('#ref-model').value = modelId;
  $('#ref-gender').value = gender;
  $('#ref-system').value = sizeSystem;
  $('#ref-size').value = sizeValue;

  // Sync manual fields to reflect selection
  $('#ref-manual-brand').value = brandId;
  await populateModelSelect('#ref-manual-model', brandId);
  if (modelId) $('#ref-manual-model').value = modelId;
  $('#ref-manual-gender').value = gender;
  $('#ref-manual-system').value = sizeSystem;
  await populateSizeSelect($('#ref-manual-size'), brandId, gender, sizeSystem);
  $('#ref-manual-size').value = sizeValue;

  updateCompareButton();
});

// ---------------------------------------------------------------------------
// Compare tab — current shoe manual entry
// ---------------------------------------------------------------------------

$('#ref-manual-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#ref-manual-model', e.target.value);
  await refreshRefManualSizes();
  syncRefManualToHidden();
  $('#ref-shoe').value = '';
});

$('#ref-manual-model').addEventListener('change', () => {
  syncRefManualToHidden();
  $('#ref-shoe').value = '';
});

$('#ref-manual-gender').addEventListener('change', async () => {
  await refreshRefManualSizes();
  syncRefManualToHidden();
  $('#ref-shoe').value = '';
});

$('#ref-manual-system').addEventListener('change', async () => {
  await refreshRefManualSizes();
  syncRefManualToHidden();
  $('#ref-shoe').value = '';
});

$('#ref-manual-size').addEventListener('change', () => {
  syncRefManualToHidden();
  $('#ref-shoe').value = '';
});

async function refreshRefManualSizes() {
  const brandId = $('#ref-manual-brand').value;
  const gender = $('#ref-manual-gender').value;
  const system = $('#ref-manual-system').value;
  await populateSizeSelect($('#ref-manual-size'), brandId, gender, system);
}

function syncRefManualToHidden() {
  $('#ref-brand').value = $('#ref-manual-brand').value;
  $('#ref-model').value = $('#ref-manual-model').value;
  $('#ref-gender').value = $('#ref-manual-gender').value;
  $('#ref-system').value = $('#ref-manual-system').value;
  $('#ref-size').value = $('#ref-manual-size').value;
  updateCompareButton();
}

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

// ---------------------------------------------------------------------------
// Compare tab — manual ref shoe entry
// ---------------------------------------------------------------------------

async function refreshRefManualSizes() {
  const brandId = $('#ref-brand-manual').value;
  const gender = $('#ref-gender-manual').value;
  const system = $('#ref-system-manual').value;
  await populateSizeSelect($('#ref-size-manual'), brandId, gender, system);
}

$('#ref-brand-manual').addEventListener('change', async (e) => {
  const brandId = e.target.value;
  await populateModelSelect('#ref-model-manual', brandId);
  await refreshRefManualSizes();
  $('#ref-brand').value = brandId;
  $('#ref-model').value = '';
  $('#ref-size').value = '';
  $('#ref-shoe').value = '';
  updateCompareButton();
});

$('#ref-model-manual').addEventListener('change', (e) => {
  $('#ref-model').value = e.target.value;
  $('#ref-shoe').value = '';
  updateCompareButton();
});

$('#ref-gender-manual').addEventListener('change', async (e) => {
  await refreshRefManualSizes();
  $('#ref-gender').value = e.target.value;
  $('#ref-size').value = '';
  $('#ref-shoe').value = '';
  updateCompareButton();
});

$('#ref-system-manual').addEventListener('change', async (e) => {
  await refreshRefManualSizes();
  $('#ref-system').value = e.target.value;
  $('#ref-size').value = '';
  $('#ref-shoe').value = '';
  updateCompareButton();
});

$('#ref-size-manual').addEventListener('change', (e) => {
  $('#ref-size').value = e.target.value;
  $('#ref-shoe').value = '';
  updateCompareButton();
});

// Initial fallback size population for manual ref shoe
populateSizeSelect($('#ref-size-manual'), null, 'mens', 'us');

async function refreshAllShoeUI() {
  const shoes = await loadUserShoes();
  renderShoeList(shoes);
  populateRefShoeDropdown(shoes);
  populateCompShoeDropdown(shoes);
  populateReportRefShoeDropdown(shoes);
  populateReportCompShoeDropdown(shoes);
}

// ---------------------------------------------------------------------------
// Compare tab — compared shoe quick-select
// ---------------------------------------------------------------------------

function populateCompShoeDropdown(shoes) {
  const select = $('#comp-shoe');
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
    opt.dataset.modelFamily = shoe.model_family || shoe.model_name || '';
    select.appendChild(opt);
  }
}

$('#comp-shoe').addEventListener('change', async (e) => {
  const opt = e.target.selectedOptions[0];
  if (!opt || !opt.value) {
    $('#comp-brand').value = '';
    $('#comp-model').innerHTML = '<option value="">Select model...</option>';
    $('#comp-model').disabled = true;
    updateCompareButton();
    return;
  }

  const brandId = opt.dataset.brandId;
  const modelId = opt.dataset.modelId;

  $('#comp-brand').value = brandId;
  await populateModelSelect('#comp-model', brandId);
  if (modelId) $('#comp-model').value = modelId;
  updateCompareButton();
});

// ---------------------------------------------------------------------------
// Compare tab logic
// ---------------------------------------------------------------------------

$('#comp-brand').addEventListener('change', async (e) => {
  await populateModelSelect('#comp-model', e.target.value);
  // Clear My Shoes picker when manual fields change
  $('#comp-shoe').value = '';
  updateCompareButton();
});

$('#comp-model').addEventListener('change', () => {
  $('#comp-shoe').value = '';
  updateCompareButton();
});

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

  if (isNaN(refBrandId) || isNaN(compBrandId) || isNaN(refSize)) {
    showStatus('#compare-status', 'Invalid selection. Please check your inputs.', 'error');
    return;
  }

  try {

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

  let sizeHtml = '';
  let chartSize = null; // US size from chart, used for sizing tip

  if (conversion) {
    // Highlight the user's chosen system as the primary result
    const primarySize = conversion[sizeSystem === 'uk' ? 'uk_size' : sizeSystem === 'eu' ? 'eu_size' : 'us_size'];
    const primaryLabel = sysLabel;
    chartSize = parseFloat(conversion.us_size);

    sizeHtml = `
      <div class="label">Equivalent size (based on foot length)</div>
      <div class="value">${primaryLabel} ${primarySize}</div>
      <div class="detail">
        US ${conversion.us_size} | UK ${conversion.uk_size || '—'} | EU ${conversion.eu_size || '—'} | ${conversion.cm_length || '—'} cm
      </div>
    `;
  } else {
    sizeHtml = `
      <div class="label">Size conversion</div>
      <div class="detail">No size chart data available for this combination.</div>
    `;
  }

  // 2. Crowdsourced fit data (if models selected)
  const fitDiv = $('#fit-data');
  let fitOffset = null; // relative offset used for sizing tip

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
      // Capture numeric offset for sizing tip
      const weightedSum = fitData.reduce((s, r) => s + (r.avg_offset || 0) * r.count, 0);
      fitOffset = displayTotal > 0 ? weightedSum / displayTotal : 0;
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
        <div class="label">Crowdsourced fit data (${displayTotal} reports) ${sourceLabel} ${confidenceLabel(displayTotal, true)}</div>
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
      // Fallback: show per-model fit consensus from seed/scraped data
      let consensusHtml = '';
      try {
        const [refConsensus, compConsensus] = await Promise.all([
          sendMessage({ type: 'GET_MODEL_FIT_CONSENSUS', modelId: refModelId }),
          sendMessage({ type: 'GET_MODEL_FIT_CONSENSUS', modelId: compModelId }),
        ]);
        const refData = refConsensus?.data || { length: [], width: [] };
        const compData = compConsensus?.data || { length: [], width: [] };
        const compLenTotal = compData.length.reduce((s, r) => s + r.count, 0);
        const refLenTotal = refData.length.reduce((s, r) => s + r.count, 0);

        if (compLenTotal > 0) {
          const tts = compData.length.find((r) => r.fit_rating === 'true_to_size');
          const small = compData.length.find((r) => r.fit_rating === 'runs_small');
          const large = compData.length.find((r) => r.fit_rating === 'runs_large');

          const compWidthTotal = compData.width.reduce((s, r) => s + r.count, 0);
          const ttw = compData.width.find((r) => r.width_rating === 'true_to_width');
          const narrow = compData.width.find((r) => r.width_rating === 'too_narrow');
          const wide = compData.width.find((r) => r.width_rating === 'too_wide');

          let widthHtml = '';
          if (compWidthTotal > 0) {
            widthHtml = `
              <div class="fit-section-heading">Width</div>
              <div class="fit-bar-container">
                ${fitBarRow('Good fit', ttw?.count || 0, compWidthTotal, 'ttw')}
                ${fitBarRow('Too narrow', narrow?.count || 0, compWidthTotal, 'narrow')}
                ${fitBarRow('Too wide', wide?.count || 0, compWidthTotal, 'wide')}
              </div>
            `;
          }

          // Derive relative offset if both models have consensus data
          let offsetNote = '';
          if (refLenTotal > 0) {
            const refAvg = refData.length.reduce((s, r) => s + (r.avg_offset || 0) * r.count, 0) / refLenTotal;
            const compAvg = compData.length.reduce((s, r) => s + (r.avg_offset || 0) * r.count, 0) / compLenTotal;
            const diff = compAvg - refAvg;
            fitOffset = diff; // capture for sizing tip
            if (Math.abs(diff) >= 0.1) {
              const direction = diff > 0 ? 'larger' : 'smaller';
              const diffStr = Math.abs(diff).toFixed(1);
              offsetNote = `<div class="detail">Estimated relative offset: ${direction} by ~${diffStr} sizes</div>`;
            }
          }

          consensusHtml = `
            <div class="label">Fit insight ${confidenceLabel(compLenTotal, false)}</div>
            <div class="fit-section-heading">How this shoe generally fits</div>
            <div class="fit-bar-container">
              ${fitBarRow('Good fit', tts?.count || 0, compLenTotal, 'tts')}
              ${fitBarRow('Too small', small?.count || 0, compLenTotal, 'small')}
              ${fitBarRow('Too large', large?.count || 0, compLenTotal, 'large')}
            </div>
            ${offsetNote}
            ${widthHtml}
            <div class="detail" style="margin-top:8px;opacity:0.7">Submit a direct comparison to improve accuracy for this pair.</div>
          `;
        }
      } catch (e) {
        console.error('[FitShift] Consensus fallback error:', e);
      }

      if (consensusHtml) {
        fitDiv.innerHTML = consensusHtml;
      } else {
        fitDiv.innerHTML = `
          <div class="label">Crowdsourced fit data</div>
          <div class="detail">No fit reports yet for this combination. Be the first to report!</div>
        `;
      }
    }

    // Version-to-version fit change notes
    try {
      const notesResp = await sendMessage({ type: 'GET_VERSION_FIT_NOTES', modelId: compModelId });
      const notes = notesResp?.data || [];
      for (const note of notes) {
        const el = document.createElement('div');
        el.className = 'version-note';
        el.textContent = note;
        fitDiv.appendChild(el);
      }
    } catch (e) {
      console.error('[FitShift] Version fit notes error:', e);
    }
  } else {
    fitDiv.innerHTML = `
      <div class="label">Crowdsourced fit data</div>
      <div class="detail">Select specific models above to see community fit data.</div>
    `;
  }

  // Append sizing tip to size card when fit offset data suggests a half-size adjustment
  if (conversion && chartSize && fitOffset !== null && Math.abs(fitOffset) >= 0.1) {
    if (fitOffset > 0) {
      const suggested = chartSize - 0.5;
      sizeHtml += `<div class="detail sizing-tip">Community reports suggest this shoe runs large — consider trying US ${suggested}</div>`;
    } else {
      const suggested = chartSize + 0.5;
      sizeHtml += `<div class="detail sizing-tip">Community reports suggest this shoe runs small — consider trying US ${suggested}</div>`;
    }
  }
  sizeDiv.innerHTML = sizeHtml;

  $('#compare-results').classList.remove('hidden');

  } catch (e) {
    console.error('[FitShift] Compare error:', e);
    showStatus('#compare-status', 'Error comparing sizes. Please try again.', 'error');
  }
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

function confidenceLabel(reportCount, isDirect) {
  if (!isDirect) {
    return '<span class="confidence-label confidence-low">Low confidence</span>';
  }
  if (reportCount < 10) {
    return '<span class="confidence-label confidence-medium">Medium confidence</span>';
  }
  return '<span class="confidence-label confidence-high">High confidence</span>';
}

// ---------------------------------------------------------------------------
// Report tab — manual entry toggle
// ---------------------------------------------------------------------------

$$('.toggle-manual').forEach((divider) => {
  const label = divider.dataset.label || 'or enter manually';
  divider.addEventListener('click', () => {
    const target = $(`#${divider.dataset.target}`);
    const isOpen = !target.classList.contains('hidden');
    if (isOpen) {
      target.classList.add('hidden');
      divider.classList.remove('open');
      divider.querySelector('span').innerHTML = `${label} &#9662;`;
    } else {
      target.classList.remove('hidden');
      divider.classList.add('open');
      divider.querySelector('span').innerHTML = `${label} &#9652;`;
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
  console.log('[FitShift] Submit Report clicked');
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
    const missing = [];
    if (!refModelId) missing.push('reference model');
    if (!refSize) missing.push('reference size');
    if (!compModelId) missing.push('compared model');
    if (!compSize) missing.push('compared size');
    if (!lengthBtn) missing.push('length fit');
    if (!widthBtn) missing.push('width fit');
    console.warn('[FitShift] Submit blocked — missing:', missing.join(', '));
    showStatus('#report-status', `Please fill in: ${missing.join(', ')}.`, 'error');
    return;
  }

  try {
    // Convert sizes to US for storage if entered in a different system
    let refSizeUs = parseFloat(refSize);
    if (isNaN(refSizeUs)) {
      showStatus('#report-status', 'Invalid reference size.', 'error');
      return;
    }
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
    if (isNaN(compSizeUs)) {
      showStatus('#report-status', 'Invalid compared size.', 'error');
      return;
    }
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

    const fitOffset = parseFloat(lengthBtn.dataset.offset);
    const report = {
      referenceModelId: parseInt(refModelId),
      referenceSizeUs: refSizeUs,
      referenceGender: refGender,
      comparedModelId: parseInt(compModelId),
      comparedSizeUs: compSizeUs,
      comparedGender: compGender,
      fitRating: lengthBtn.dataset.fit,
      fitOffset: isNaN(fitOffset) ? 0 : fitOffset,
      widthRating: widthBtn.dataset.width,
      source: 'user',
    };

    // Include profile data if available
    try {
      const profileResponse = await sendMessage({ type: 'GET_PROFILE' });
      if (profileResponse?.data) {
        report.userHeightCm = profileResponse.data.height_cm;
        report.userWeightKg = profileResponse.data.weight_kg;
        report.userFootLengthCm = profileResponse.data.foot_length_cm;
      }
    } catch (e) {
      // Profile data is optional, continue without it
    }

    const response = await sendMessage({ type: 'SUBMIT_FIT_REPORT', report });

    if (response?.success) {
      showStatus('#report-status', 'Fit report submitted! Thanks for contributing.', 'success');
    } else {
      showStatus('#report-status', 'Error submitting report. Please try again.', 'error');
    }
  } catch (e) {
    console.error('[FitShift] Report submit error:', e);
    showStatus('#report-status', 'Error submitting report. Please try again.', 'error');
  }
});

// ---------------------------------------------------------------------------
// Profile tab logic
// ---------------------------------------------------------------------------

async function loadProfile() {
  try {
    const response = await sendMessage({ type: 'GET_PROFILE' });
    if (response?.data) {
      const p = response.data;
      if (p.height_cm) $('#profile-height').value = p.height_cm;
      if (p.weight_kg) $('#profile-weight').value = p.weight_kg;
      if (p.foot_length_cm) $('#profile-foot-length').value = p.foot_length_cm;
      if (p.foot_width) $('#profile-foot-width').value = p.foot_width;
    }
  } catch (e) {
    console.error('[FitShift] Failed to load profile:', e);
  }
}

let _profileSaveTimer = null;

function autoSaveProfile() {
  clearTimeout(_profileSaveTimer);
  _profileSaveTimer = setTimeout(async () => {
    const heightVal = parseFloat($('#profile-height').value);
    const weightVal = parseFloat($('#profile-weight').value);
    const footLenVal = parseFloat($('#profile-foot-length').value);

    const profile = {
      heightCm: isNaN(heightVal) ? null : heightVal,
      weightKg: isNaN(weightVal) ? null : weightVal,
      footLengthCm: isNaN(footLenVal) ? null : footLenVal,
      footWidth: $('#profile-foot-width').value || null,
    };

    try {
      const response = await sendMessage({ type: 'UPDATE_PROFILE', profile });
      if (response?.success) {
        const el = $('#profile-status');
        el.textContent = 'Saved';
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 1500);
      }
    } catch (e) {
      console.error('[FitShift] Failed to auto-save profile:', e);
    }
  }, 1000);
}

['#profile-height', '#profile-weight', '#profile-foot-length'].forEach(sel => {
  $(sel).addEventListener('input', autoSaveProfile);
});
$('#profile-foot-width').addEventListener('change', autoSaveProfile);

async function loadStats() {
  try {
    const response = await sendMessage({ type: 'GET_STATS' });
    if (response?.data) {
      const count = response.data.fitReportCount || 0;
      const countEl = $('#stats-content');
      countEl.textContent = '';
      const span = document.createElement('span');
      span.className = 'stats-count';
      span.textContent = count.toLocaleString();
      countEl.appendChild(span);
      countEl.appendChild(document.createTextNode(' shoes compared by the community'));
    }
  } catch (e) {
    console.error('[FitShift] Failed to load stats:', e);
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
      try {
        await sendMessage({ type: 'DELETE_USER_SHOE', shoeId });
        await refreshAllShoeUI();
      } catch (err) {
        console.error('[FitShift] Failed to delete shoe:', err);
      }
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

  const parsedSize = parseFloat(sizeValue);
  if (isNaN(parsedSize)) {
    showStatus('#shoe-status', 'Invalid size value.', 'error');
    return;
  }

  try {
    const response = await sendMessage({
      type: 'ADD_USER_SHOE',
      brandId: parseInt(brandId),
      modelId: modelId ? parseInt(modelId) : null,
      gender,
      sizeSystem,
      sizeValue: parsedSize,
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
  } catch (e) {
    console.error('[FitShift] Failed to save shoe:', e);
    showStatus('#shoe-status', 'Error saving shoe.', 'error');
  }
});

// ---------------------------------------------------------------------------
// Data export/import
// ---------------------------------------------------------------------------

$('#btn-export').addEventListener('click', async () => {
  try {
    const response = await sendMessage({ type: 'EXPORT_USER_DATA' });
    if (!response?.data) {
      showStatus('#backup-status', 'No data to export.', 'error');
      return;
    }
    const json = JSON.stringify(response.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitshift-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus('#backup-status', 'Data exported successfully.', 'success');
  } catch (e) {
    console.error('[FitShift] Export error:', e);
    showStatus('#backup-status', 'Error exporting data.', 'error');
  }
});

$('#btn-import').addEventListener('click', () => {
  $('#import-file').click();
});

$('#import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseErr) {
      showStatus('#backup-status', 'Invalid JSON file.', 'error');
      return;
    }

    if (!data.version || data.version !== 1) {
      showStatus('#backup-status', 'Unsupported backup version.', 'error');
      return;
    }

    const response = await sendMessage({ type: 'IMPORT_USER_DATA', data });

    if (response?.success) {
      const parts = [];
      if (response.profileImported) parts.push('profile');
      if (response.shoesImported > 0) parts.push(`${response.shoesImported} shoes`);
      if (response.reportsImported > 0) parts.push(`${response.reportsImported} fit reports`);
      const summary = parts.length > 0 ? parts.join(', ') : 'no new data';
      showStatus('#backup-status', `Imported: ${summary}.`, 'success');

      // Refresh UI
      brandsCache = null;
      await loadProfile();
      await refreshAllShoeUI();
      await loadStats();
    } else {
      showStatus('#backup-status', response?.error || 'Import failed.', 'error');
    }
  } catch (err) {
    console.error('[FitShift] Import error:', err);
    showStatus('#backup-status', 'Error importing data.', 'error');
  }

  // Reset file input so the same file can be selected again
  e.target.value = '';
});

// ---------------------------------------------------------------------------
// Auth UI
// ---------------------------------------------------------------------------

async function loadAuthState() {
  try {
    const response = await sendMessage({ type: 'GET_AUTH_STATE' });
    if (response?.signedIn && response.user) {
      showSignedInUI(response.user);
    } else {
      showSignedOutUI();
    }
  } catch (e) {
    console.error('[FitShift] Failed to load auth state:', e);
    showSignedOutUI();
  }
}

function showSignedInUI(user) {
  $('#auth-signed-out').classList.add('hidden');
  $('#auth-signed-in').classList.remove('hidden');
  $('#auth-name').textContent = user.displayName || '';
  $('#auth-email').textContent = user.email || '';
  const avatar = $('#auth-avatar');
  if (user.photoUrl) {
    avatar.src = user.photoUrl;
    avatar.style.display = '';
  } else {
    avatar.style.display = 'none';
  }
}

function showSignedOutUI() {
  $('#auth-signed-out').classList.remove('hidden');
  $('#auth-signed-in').classList.add('hidden');
  $('#sync-status').textContent = '';
  $('#sync-status').className = 'sync-status';
}

function showSyncStatus(msg, type) {
  const el = $('#sync-status');
  el.textContent = msg;
  el.className = 'sync-status' + (type ? ' ' + type : '');
}

function resetSignInButton(btn) {
  btn.textContent = '';
  const img = document.createElement('img');
  img.src = '../icons/google-g.svg';
  img.width = 18;
  img.height = 18;
  img.alt = '';
  btn.appendChild(img);
  btn.appendChild(document.createTextNode(' Sign in with Google'));
}

$('#btn-sign-in').addEventListener('click', async () => {
  const btn = $('#btn-sign-in');
  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const response = await sendMessage({ type: 'SIGN_IN' });

    if (response?.success) {
      showSignedInUI(response.user);
      showSyncStatus('Data synced', 'success');
      // Refresh UI with potentially new cloud data
      brandsCache = null;
      await loadProfile();
      await refreshAllShoeUI();
      await loadStats();
    } else {
      showSyncStatus(response?.error || 'Sign-in failed', 'error');
    }
  } catch (e) {
    console.error('[FitShift] Sign-in error:', e);
    showSyncStatus('Sign-in failed', 'error');
  }

  btn.disabled = false;
  resetSignInButton(btn);
});

$('#btn-sign-out').addEventListener('click', async () => {
  try {
    await sendMessage({ type: 'SIGN_OUT' });
  } catch (e) {
    console.error('[FitShift] Sign-out error:', e);
  }
  showSignedOutUI();
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

async function init() {
  // Populate all brand selects
  await Promise.all([
    populateBrandSelect('#ref-manual-brand'),
    populateBrandSelect('#comp-brand'),
    populateBrandSelect('#report-ref-brand'),
    populateBrandSelect('#report-comp-brand'),
    populateBrandSelect('#shoe-brand'),
  ]);

  // Load auth state, profile, stats, and user shoes
  await loadAuthState();
  await loadProfile();
  await loadStats();
  await refreshAllShoeUI();
}

init();
