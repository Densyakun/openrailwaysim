/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.geojson$/,
      use: 'json-loader',
    })

    return config
  },
}

const withTM = require('next-transpile-modules')(['three'])
module.exports = withTM(nextConfig)
