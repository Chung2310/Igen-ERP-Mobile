const { expo } = require('./app.json');

module.exports = () => ({
  ...expo,
  version: process.env.APP_VERSION || expo.version,
  ios: {
    ...expo.ios,
    bundleIdentifier: process.env.ERP_IOS_BUNDLE_IDENTIFIER || expo.ios.bundleIdentifier,
    buildNumber: process.env.IOS_BUILD_NUMBER || '1',
  },
});
