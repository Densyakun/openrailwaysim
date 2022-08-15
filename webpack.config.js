const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: [
    './src/client.ts',
    'webpack-hot-middleware/client'
  ],
  devtool: 'inline-source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: 'client.bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/js',
  },
};