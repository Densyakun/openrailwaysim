/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.geojson$/,
      use: 'json-loader',
    })

    return config
  },
}

export default nextConfig
