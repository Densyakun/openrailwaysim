var express = require('express');
var router = express.Router();

const path = require('path');
const worldDir = path.join(__dirname, '../worlds/');
const fs = require('fs-extra');

fs.mkdir(worldDir, { recursive: true }, (err) => {
  if (err)
    throw err;
});

// list
router.get('/', function (req, res, next) {
  fs.readdir(worldDir, { withFileTypes: true }, (err, dirents) => {
    if (err) {
      next(err);
    } else {
      res.send(dirents);
    }
  });
});

// create
router.post('/', function (req, res, next) {
  fs.mkdir(path.join(worldDir, req.body.name), { recursive: false }, (err) => {
    if (err) {
      if (err.code === 'EEXIST')
        res.status(500).send({ error: err.code });
      else
        next(err);
    } else
      res.end();
  });
});

module.exports = router;
