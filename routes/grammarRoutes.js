const express = require('express');
const router = express.Router();

router.post('/check', async (req, res) => {
  try {
    const {
      text = '',
      language = 'en-US',
      motherTongue,
      disabledRules,
      apiPath = '/v2/check',
      endpoint = 'https://api.languagetool.org'
    } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(200).json({ matches: [] });
    }

    const url = `${endpoint}${apiPath}`;
    const params = new URLSearchParams();
    params.set('text', text);
    params.set('language', language);
    if (motherTongue) params.set('motherTongue', motherTongue);
    if (Array.isArray(disabledRules) && disabledRules.length) {
      params.set('disabledRules', disabledRules.join(','));
    }

    const ltRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!ltRes.ok) {
      const text = await ltRes.text().catch(() => '');
      return res.status(ltRes.status).json({ success: false, error: `LT error ${ltRes.status}`, body: text });
    }

    const json = await ltRes.json();
    return res.json(json);
  } catch (err) {
    console.error('Grammar proxy error:', err);
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

module.exports = router;
