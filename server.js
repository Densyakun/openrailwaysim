const webpack = require('webpack');
const config = require('./webpack.config.js');
const compiler = webpack(config);

var { app, start } = require('./app');

app.use(require('webpack-dev-middleware')(compiler, {
  publicPath: config.output.publicPath,
  writeToDisk: true,
}));

app.use(require("webpack-hot-middleware")(compiler));

start();
