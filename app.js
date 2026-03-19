/* ═══════════════════════════════════════════════════════════
   AI 翻譯助手 — app.js
   前端邏輯：AI 設定、提示詞翻譯、Plan 翻譯
═══════════════════════════════════════════════════════════ */

'use strict';

// ─── Storage Keys ─────────────────────────────────────────
const STORAGE_PLATFORM = 'ai_trans_platform';
const STORAGE_KEY      = 'ai_trans_apikey';

// ─── API Endpoint ──────────────────────────────────────────
// 部署到 Netlify 後透過 Function 代理；本地開發用 netlify dev
const API_URL = '/.netlify/functions/translate';

// ══════════════════════════════════════════════════════════
// DOM Elements
// ══════════════════════════════════════════════════════════
const $ = (id) => document.getElementById(id);

// Navbar
const settingsBtn    = $('settingsBtn');
const navStatusBadge = $('navStatusBadge');
const navStatusText  = $('navStatusText');

// Drawer
const drawerOverlay  = $('drawerOverlay');
const settingsDrawer = $('settingsDrawer');
const drawerCloseBtn = $('drawerCloseBtn');
const connectBtn     = $('connectBtn');
const connectIcon    = $('connectIcon');
const connectText    = $('connectText');
const connStatus     = $('connStatus');
const apiKeyInput    = $('apiKeyInput');
const apiKeyToggle   = $('apiKeyToggle');
const apiKeyLabel    = $('apiKeyLabel');

// Platform radios
const platformRadios = document.querySelectorAll('input[name="platform"]');
const cardDeepSeek   = $('cardDeepSeek');
const cardGemini     = $('cardGemini');

// Tab
const tab1Btn = $('tab1Btn');
const tab2Btn = $('tab2Btn');
const panel1  = $('panel1');
const panel2  = $('panel2');

// Prompt Tab
const promptInput    = $('promptInput');
const promptTransBtn = $('promptTransBtn');
const promptTransIcon = $('promptTransIcon');
const promptTransText = $('promptTransText');
const promptClearBtn = $('promptClearBtn');
const promptOutput   = $('promptOutput');
const promptCopyBtn  = $('promptCopyBtn');
const promptError    = $('promptError');

// Plan Tab
const planInput        = $('planInput');
const planTransBtn     = $('planTransBtn');
const planTransIcon    = $('planTransIcon');
const planTransText    = $('planTransText');
const planClearBtn     = $('planClearBtn');
const planOutput       = $('planOutput');
const planResultContainer = $('planResultContainer');
const planPlaceholder  = $('planPlaceholder');
const planCopyBtn      = $('planCopyBtn');
const planCopyZhBtn    = $('planCopyZhBtn');
const planError        = $('planError');

// Toast
const toastContainer = $('toastContainer');


// ══════════════════════════════════════════════════════════
// State
// ══════════════════════════════════════════════════════════
let isConnected    = false;
let currentPlatform = 'deepseek';

// Stored plan pairs for copy
let planPairs = []; // [{en, zh}]


// ══════════════════════════════════════════════════════════
// Init
// ══════════════════════════════════════════════════════════
function init() {
  // Load saved settings
  const savedPlatform = localStorage.getItem(STORAGE_PLATFORM) || 'deepseek';
  const savedKey      = localStorage.getItem(STORAGE_KEY) || '';

  setPlatform(savedPlatform);
  apiKeyInput.value = savedKey;

  if (savedKey) {
    // Mark as connected (key was saved previously)
    setConnectedState(true, `已載入 ${getPlatformName(savedPlatform)} API Key`);
  }

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  bindEvents();
}


// ══════════════════════════════════════════════════════════
// Event Binding
// ══════════════════════════════════════════════════════════
function bindEvents() {
  // Settings drawer
  settingsBtn.addEventListener('click', openDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);

  // Platform selection
  platformRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      setPlatform(radio.value);
      // Reset connection status when switching platform
      resetConnectionStatus();
      const savedKey = localStorage.getItem(STORAGE_KEY + '_' + radio.value) || '';
      apiKeyInput.value = savedKey;
    });
  });

  // API Key toggle visibility
  apiKeyToggle.addEventListener('click', () => {
    const isHidden = apiKeyInput.type === 'password';
    apiKeyInput.type = isHidden ? 'text' : 'password';
    apiKeyToggle.textContent = isHidden ? '🙈' : '👁';
  });

  // Connect & Save
  connectBtn.addEventListener('click', handleConnect);
  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleConnect();
  });

  // Tabs
  tab1Btn.addEventListener('click', () => switchTab(1));
  tab2Btn.addEventListener('click', () => switchTab(2));

  // Prompt Tab
  promptTransBtn.addEventListener('click', handlePromptTranslate);
  promptClearBtn.addEventListener('click', () => {
    promptInput.value = '';
    promptOutput.value = '';
    hideError(promptError);
    promptInput.focus();
  });
  promptCopyBtn.addEventListener('click', () => {
    copyText(promptOutput.value, '已複製英文翻譯 ✓');
  });

  // Plan Tab
  planTransBtn.addEventListener('click', handlePlanTranslate);
  planClearBtn.addEventListener('click', () => {
    planInput.value = '';
    planOutput.innerHTML = '';
    planPlaceholder.style.display = 'flex';
    planPairs = [];
    hideError(planError);
    planInput.focus();
  });
  planCopyBtn.addEventListener('click', () => {
    const text = planPairs.map(p => `${p.en}\n${p.zh}`).join('\n\n');
    copyText(text, '已複製中英對照全文 ✓');
  });
  planCopyZhBtn.addEventListener('click', () => {
    const text = planPairs.map(p => p.zh).join('\n\n');
    copyText(text, '已複製中文翻譯 ✓');
  });
}


// ══════════════════════════════════════════════════════════
// Tab Switching
// ══════════════════════════════════════════════════════════
function switchTab(num) {
  if (num === 1) {
    tab1Btn.classList.add('active');
    tab2Btn.classList.remove('active');
    panel1.classList.add('active');
    panel2.classList.remove('active');
    tab1Btn.setAttribute('aria-selected', 'true');
    tab2Btn.setAttribute('aria-selected', 'false');
  } else {
    tab2Btn.classList.add('active');
    tab1Btn.classList.remove('active');
    panel2.classList.add('active');
    panel1.classList.remove('active');
    tab2Btn.setAttribute('aria-selected', 'true');
    tab1Btn.setAttribute('aria-selected', 'false');
  }
}


// ══════════════════════════════════════════════════════════
// Drawer
// ══════════════════════════════════════════════════════════
function openDrawer() {
  settingsDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  settingsDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  document.body.style.overflow = '';
}


// ══════════════════════════════════════════════════════════
// Platform
// ══════════════════════════════════════════════════════════
function setPlatform(value) {
  currentPlatform = value;
  platformRadios.forEach((r) => {
    r.checked = r.value === value;
  });
  cardDeepSeek.classList.toggle('selected', value === 'deepseek');
  cardGemini.classList.toggle('selected', value === 'gemini');
  apiKeyLabel.textContent = `${getPlatformName(value)} API Key`;
}

function getPlatformName(platform) {
  return platform === 'deepseek' ? 'DeepSeek' : 'Gemini';
}


// ══════════════════════════════════════════════════════════
// Connect & Test
// ══════════════════════════════════════════════════════════
async function handleConnect() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showConnStatus('error', '請先輸入 API Key');
    return;
  }

  setConnectLoading(true);

  try {
    const result = await callAPI({
      platform: currentPlatform,
      apiKey,
      action: 'test',
      text: '',
    });

    // Save to localStorage (per-platform)
    localStorage.setItem(STORAGE_PLATFORM, currentPlatform);
    localStorage.setItem(STORAGE_KEY, apiKey);
    localStorage.setItem(STORAGE_KEY + '_' + currentPlatform, apiKey);

    setConnectedState(true, `${getPlatformName(currentPlatform)} 連線成功！已儲存`);
    showToast('✅ 連線成功，API Key 已儲存');
  } catch (err) {
    setConnectedState(false);
    showConnStatus('error', `❌ 連線失敗：${err.message}`);
  } finally {
    setConnectLoading(false);
  }
}

function setConnectLoading(loading) {
  connectBtn.disabled = loading;
  if (loading) {
    connectIcon.outerHTML = '<span id="connectIcon" class="spinner"></span>';
    $('connectIcon').outerHTML = '<span class="spinner" id="connectIcon"></span>';
    connectText.textContent = '連線測試中...';
  } else {
    connectText.textContent = '連線測試 / 儲存';
    const iconEl = $('connectIcon');
    if (iconEl) iconEl.textContent = '🔗';
  }
}

function setConnectedState(connected, message) {
  isConnected = connected;
  if (connected) {
    navStatusBadge.className = 'status-badge success';
    navStatusText.textContent = getPlatformName(currentPlatform);
    if (message) showConnStatus('success', `✅ ${message}`);
  } else {
    navStatusBadge.className = 'status-badge idle';
    navStatusText.textContent = '未連線';
  }
}

function resetConnectionStatus() {
  connStatus.innerHTML = '';
  isConnected = false;
  navStatusBadge.className = 'status-badge idle';
  navStatusText.textContent = '未連線';
}

function showConnStatus(type, message) {
  connStatus.innerHTML = `
    <div class="status-badge ${type}" style="width:100%;border-radius:8px;padding:9px 14px;">
      ${message}
    </div>`;
}


// ══════════════════════════════════════════════════════════
// Prompt Translation (中文 → 英文)
// ══════════════════════════════════════════════════════════
async function handlePromptTranslate() {
  const text = promptInput.value.trim();
  if (!text) { showToast('請輸入要翻譯的中文內容'); return; }

  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('⚠️ 請先在設定中輸入 API Key');
    openDrawer();
    return;
  }

  hideError(promptError);
  setTranslateLoading(promptTransBtn, promptTransIcon, promptTransText, true, '翻譯中...');
  promptOutput.value = '';

  try {
    const result = await callAPI({
      platform: currentPlatform,
      apiKey,
      action: 'translate_prompt',
      text,
    });
    promptOutput.value = result;
    showToast('✅ 翻譯完成');
  } catch (err) {
    showError(promptError, err.message);
  } finally {
    setTranslateLoading(promptTransBtn, promptTransIcon, promptTransText, false, '翻譯為英文');
  }
}


// ══════════════════════════════════════════════════════════
// Plan Translation (英文 → 中英對照)
// ══════════════════════════════════════════════════════════
async function handlePlanTranslate() {
  const text = planInput.value.trim();
  if (!text) { showToast('請貼入要翻譯的英文內容'); return; }

  const apiKey = getApiKey();
  if (!apiKey) {
    showToast('⚠️ 請先在設定中輸入 API Key');
    openDrawer();
    return;
  }

  hideError(planError);
  setTranslateLoading(planTransBtn, planTransIcon, planTransText, true, '翻譯中...');
  planOutput.innerHTML = '';
  planPlaceholder.style.display = 'flex';
  planPairs = [];

  try {
    const result = await callAPI({
      platform: currentPlatform,
      apiKey,
      action: 'translate_plan',
      text,
    });

    planPairs = parsePlanResult(result, text);

    if (planPairs.length === 0) {
      showError(planError, '無法解析翻譯結果，請重試。');
    } else {
      renderPlanPairs(planPairs);
      planPlaceholder.style.display = 'none';
      showToast(`✅ 翻譯完成，共 ${planPairs.length} 段`);
    }
  } catch (err) {
    showError(planError, err.message);
  } finally {
    setTranslateLoading(planTransBtn, planTransIcon, planTransText, false, '生成中英對照');
  }
}

/**
 * Parse AI response for plan translation.
 * Expected format per paragraph:
 *   [EN]: original text
 *   [ZH]: translated text
 */
function parsePlanResult(result, fallbackOriginal) {
  const pairs = [];

  // Split by blank lines between pairs
  const blocks = result.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n');
    let en = '';
    let zh = '';

    for (const line of lines) {
      if (line.startsWith('[EN]:')) {
        en = line.replace('[EN]:', '').trim();
      } else if (line.startsWith('[ZH]:')) {
        zh = line.replace('[ZH]:', '').trim();
      }
    }

    if (en && zh) {
      pairs.push({ en, zh });
    }
  }

  // Fallback: if AI returned plain translation without markers,
  // split by newlines and pair them
  if (pairs.length === 0) {
    const originalParas = fallbackOriginal.split(/\n\s*\n/).filter((p) => p.trim());
    const translatedLines = result.split(/\n\s*\n/).filter((p) => p.trim());
    const count = Math.min(originalParas.length, translatedLines.length);
    for (let i = 0; i < count; i++) {
      pairs.push({ en: originalParas[i].trim(), zh: translatedLines[i].trim() });
    }
  }

  return pairs;
}

function renderPlanPairs(pairs) {
  planOutput.innerHTML = '';
  pairs.forEach((pair, i) => {
    const div = document.createElement('div');
    div.className = 'plan-pair' + (i % 2 === 0 ? '' : ' highlighted');
    div.innerHTML = `
      <p class="plan-en">${escapeHtml(pair.en)}</p>
      <p class="plan-zh">${escapeHtml(pair.zh)}</p>
    `;
    planOutput.appendChild(div);
  });
}


// ══════════════════════════════════════════════════════════
// API Call
// ══════════════════════════════════════════════════════════
async function callAPI(payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data.result;
}


// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════
function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || apiKeyInput.value.trim();
}

function setTranslateLoading(btn, iconEl, textEl, loading, label) {
  btn.disabled = loading;
  if (loading) {
    iconEl.outerHTML = `<span class="spinner" id="${iconEl.id}"></span>`;
    textEl.textContent = label;
  } else {
    const el = document.getElementById(iconEl.id);
    if (el) el.outerHTML = `<span id="${iconEl.id}">🌐</span>`;
    textEl.textContent = label;
  }
}

function showError(el, message) {
  el.textContent = `❌ ${message}`;
  el.style.display = 'block';
}

function hideError(el) {
  el.style.display = 'none';
  el.textContent = '';
}

async function copyText(text, successMsg) {
  if (!text) { showToast('沒有可複製的內容'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg || '已複製 ✓');
  } catch {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(successMsg || '已複製 ✓');
  }
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}


// ══════════════════════════════════════════════════════════
// Start App
// ══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', init);
