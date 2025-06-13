/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "did-you-em-dash",
      home: "aws",
      providers: {
        aws: {
          region: "us-west-2"
        }
      }
    };
  },
  async run() {
    new sst.aws.StaticSite("EmDashSite", {
      build: {
        command: "npm run build",
        output: "dist"
      },
      domain: "didyouemdash.com"
    });
  },
});