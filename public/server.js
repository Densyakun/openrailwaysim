const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const cors = require('cors');

const app = express();
const config = require('./webpack.config.js');
const compiler = webpack(config);

//app.use(cors());

app.use(
  webpackDevMiddleware(compiler, {
    publicPath: config.output.publicPath,
  })
);

app.use(express.static('dist'));

app.listen(3000, function () {
  console.log('Example app listening on port 3000!\n');
});
