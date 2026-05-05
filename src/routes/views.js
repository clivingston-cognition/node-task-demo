const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.render('index', {
    title: 'Hi Devin',
  });
});

module.exports = router;
