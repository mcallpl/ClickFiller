// Babel config for Jest only. The app itself is bundled by Vite and does NOT
// use Babel at runtime. This transforms the source's ESM import/export into
// CommonJS so Jest (running under jsdom) can load the test suites.
// Must be .cjs because package.json sets "type": "module".
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
  ],
};
