// Netlify Function: AI Translation Proxy
// Proxies frontend requests to DeepSeek / Gemini to resolve browser CORS restrictions

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Always return 200 so frontend can parse error details from JSON body
function ok(body) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(body) };
}
function fail(message) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
}

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return fail('Method Not Allowed');
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return fail('無效的請求格式 (JSON parse error)');
  }

  const { platform, apiKey, action, text } = body;

  if (!platform || !apiKey) return fail('缺少必要參數：platform 或 apiKey');
  if (!action) return fail('缺少必要參數：action');

  try {
    let result;

    if (platform === 'deepseek') {
      const messages = buildMessages(action, text);
      result = await callDeepSeek(apiKey, messages);
    } else if (platform === 'gemini') {
      result = await callGemini(apiKey, action, text);
    } else {
      return fail(`不支援的 AI 平台: ${platform}，請選擇 deepseek 或 gemini`);
    }

    return ok({ result });

  } catch (err) {
    console.error('[translate] Error:', err.message);
    return fail(err.message || '翻譯服務異常，請稍後再試');
  }
};

// ─── Build Messages ───────────────────────────────────────────

function buildMessages(action, text) {
  switch (action) {
    case 'test':
      return [{ role: 'user', content: 'Reply with "OK" only.' }];

    case 'translate_prompt':
      return [
        {
          role: 'system',
          content:
            "You are a professional translator. Translate the user's Chinese text into natural, fluent English. " +
            'Return ONLY the translated text with no explanations, no quotation marks, and no additional content.',
        },
        { role: 'user', content: text || '' },
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
        { role: 'user', content: text || '' },
      ];

    default:
      throw new Error(`未知的 action 類型: ${action}`);
  }
}

// ─── DeepSeek API ────────────────────────────────────────────

async function callDeepSeek(apiKey, messages) {
  let response;
  try {
    response = await fetch('https://api.deepseek.com/chat/completions', {
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
  } catch (networkErr) {
    throw new Error(`無法連接 DeepSeek API：${networkErr.message}`);
  }

  if (!response.ok) {
    let errMsg = `DeepSeek API 錯誤 (HTTP ${response.status})`;
    try {
      const errData = await response.json();
      if (errData.error?.message) errMsg = errData.error.message;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 回傳內容為空');
  return content;
}

// ─── Gemini API ──────────────────────────────────────────────

async function callGemini(apiKey, action, text) {
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const messages = buildMessages(action, text);
  const systemMsg = messages.find((m) => m.role === 'system');
  const userMsg = messages.find((m) => m.role === 'user');

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userMsg?.content || text || '' }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  };

  if (systemMsg) {
    requestBody.systemInstruction = {
      parts: [{ text: systemMsg.content }],
    };
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch (networkErr) {
    throw new Error(`無法連接 Gemini API：${networkErr.message}`);
  }

  if (!response.ok) {
    let errMsg = `Gemini API 錯誤 (HTTP ${response.status})`;
    try {
      const errData = await response.json();
      if (errData.error?.message) errMsg = errData.error.message;
    } catch {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Gemini 回傳內容為空');
  return content;
}
