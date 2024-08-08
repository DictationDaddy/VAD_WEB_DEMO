/** @type {import('next').NextConfig} */
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  reactStrictMode: true,
  //distDir: 'build',
  webpack: (config, {  }) => {

    config.resolve.extensions.push(".ts", ".tsx");
    config.resolve.fallback = { fs: false };

    config.plugins.push(
    new NodePolyfillPlugin(), 
    new CopyPlugin({
      patterns: [
        {
          from: './node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm',
          to: 'static/chunks/',
        }, 
        {
            from: './node_modules/onnxruntime-web/dist/ort-wasm-simd.wasm',
            to: 'static/chunks/',
        },         
        {
            from: './src/vad/data/silero_vad.onnx',
            to: 'static/chunks/',
        },
        ],
      }),
    );

    return config;
  },
  publicRuntimeConfig: {
    vadModelPath: '_next/static/chunks/silero_vad.onnx'
  },
  env: {
    VAD_MODEL_PATH: '_next/static/chunks/silero_vad.onnx'
  }
}
