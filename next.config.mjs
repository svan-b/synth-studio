/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The iPad app carries the piano teacher inside it as plain files, so it
  // opens with no connection. `MC_APP=1 next build` writes those files to
  // `out-app`. See ios/README.md.
  ...(process.env.MC_APP === '1' ? { output: 'export', distDir: 'out-app', images: { unoptimized: true } } : {}),
};

export default nextConfig;
