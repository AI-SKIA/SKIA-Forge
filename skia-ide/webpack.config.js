const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "development",
  target: "electron-renderer",
  entry: path.resolve(__dirname, "src/renderer/index.ts"),
  output: {
    path: path.resolve(__dirname, "dist/renderer"),
    filename: "bundle.js",
    clean: true
  },
  resolve: {
    extensions: [".ts", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: "ts-loader",
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/renderer/index.html"),
      filename: "index.html"
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            "node_modules/monaco-editor/min/vs/base/worker/workerMain.js"
          ),
          to: "vs/base/worker/workerMain.js"
        },
        {
          from: path.resolve(__dirname, "node_modules/monaco-editor/min/vs"),
          to: "vs"
        }
      ]
    })
  ]
};
