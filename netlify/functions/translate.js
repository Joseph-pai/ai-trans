// Netlify Function: AI Translation Proxy
// 代理前端請求至 DeepSeek / Gemini，解決瀏覽器 CORS 限制

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '無效的請求格式' }) };
  }

  const { platform, apiKey, action, text } = body;

  if (!platform || !apiKey) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '缺少必要參數：platform 或 apiKey' }) };
  }

  try {
    const messages = buildMessages(action, text);
    let result;

    if (platform === 'deepseek') {
      result = await callDeepSeek(apiKey, messages);
    } else if (platform === 'gemini') {
      result = await callGemini(apiKey, action, text);
    } else {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '不支援的 AI 平台，請選擇 DeepSeek 或 Gemini' }) };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ result }) };
  } catch (err) {
    console.error('Translate function error:', err);
    return { statusCode: 502, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message || '翻譯服務異常，請稍後再試' }) };
  }
};

// ─── 建立 Messages ───────────────────────────────────────────

function buildMessages(action, text) {
  switch (action) {
    case 'test':
      return [{ role: 'user', content: 'Reply with "OK" only.' }];

    case 'translate_prompt':
      return [
        {
          role: 'system',
          content:
            'You are a professional translator. Translate the user\'s Chinese text into natural, fluent English. ' +
            'Return ONLY the translated text with no explanations, no quotation marks, and no additional content.',
        },
        { role: 'user', content: text },
      ];

    case 'translate_plan':
      return [
        {
          role: 'system',
          content:
            'You are a professional translator. The user will provide English text with multiple paragraphs. ' +
            'For EACH paragraph, output exactly in this format:\n' +
            '[EN]: {original English paragraph}\n' +
            '[ZH]: {Chinese translation of that paragraph}\n\n' +
            'Separate each paragraph pair with a blank line. ' +
            'Do NOT add any other text, headers, or explanations.',
        },
        { role: 'user', content: text },
      ];

    default:
      throw new Error('未知的 action 類型');
  }
}

// ─── DeepSeek API ────────────────────────────────────────────

async function callDeepSeek(apiKey, messages) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      stream: false,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg = errData.error?.message || `DeepSeek API 錯誤 (HTTP ${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ─── Gemini API ──────────────────────────────────────────────

async function callGemini(apiKey, action, text) {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build system instruction
  const systemMessages = buildMessages(action, text);
  const systemInstruction = systemMessages.find((m) => m.role === 'system');
  const userMessage = systemMessages.find((m) => m.role === 'user');

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userMessage?.content || text }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction.content }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const msg = errData.error?.message || `Gemini API 錯誤 (HTTP ${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
