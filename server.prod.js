var { app, listen } = require('./server');
var express = require('express');
var path = require('path');

app.use(express.static(path.join(__dirname, 'dist')));

listen();
