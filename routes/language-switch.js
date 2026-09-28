// GET /set-language/:lang  — e.g. /set-language/el
import express from 'express';

const router = express.Router();

router.get('/set-language/:lang', (req, res) => {
  const { lang } = req.params;
  const supported = ['en', 'el'];

  if (supported.includes(lang)) {
    res.cookie('lang', lang, { maxAge: 1000 * 60 * 60 * 24 * 365 }); // 1 year
  }

  // Go back to whatever page the person was on, falling back to home.
  const back = req.get('Referer') || '/';
  res.redirect(back);
});

export default router;