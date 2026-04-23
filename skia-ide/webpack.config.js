const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

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
                use: [MiniCssExtractPlugin.loader, "css-loader"]
            },
            {
                test: /\.(png|jpg|jpeg|gif|svg)$/i,
                type: "asset/resource",
                generator: {
                    filename: "assets/[name][ext]"
                }
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "styles.css"
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "src/renderer/index.html"),
            filename: "index.html"
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, "node_modules/monaco-editor/min/vs"),
                    to: "vs"
                },
                // Copy logo.png from repo root
                {
                    from: path.resolve(__dirname, "../logo.png"),
                    to: "assets/logo.png"
                },
                // Copy sidebar-logo.png from repo root
                {
                    from: path.resolve(__dirname, "../sidebar-logo.png"),
                    to: "assets/sidebar-logo.png"
                },
                // Copy assets folder if it exists
                {
                    from: path.resolve(__dirname, "assets"),
                    to: "assets",
                    noErrorOnMissing: true
                }
            ]
        })
    ]
};