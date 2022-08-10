const { defineConfig } = require("@vue/cli-service");
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    port: 8080,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/websocket": {
        ws: true,
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
