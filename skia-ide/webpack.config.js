const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");

module.exports = {
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    target: "electron-renderer",
    entry: path.resolve(__dirname, "src/renderer/index.ts"),
    output: {
        path: path.resolve(__dirname, "dist/renderer"),
        filename: "bundle.js",
        clean: true
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
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
        new webpack.BannerPlugin({
            banner: "var global=globalThis;",
            raw: true,
            entryOnly: true
        }),
        new webpack.DefinePlugin({
            global: "globalThis"
        }),
        new MiniCssExtractPlugin({
            filename: "styles.css"
        }),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "src/renderer/index.html"),
            filename: "index.html",
            inject: false,
            scriptLoading: "blocking"
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.resolve(__dirname, "node_modules/monaco-editor/min/vs"),
                    to: "vs"
                },
                {
                    from: path.resolve(__dirname, "../public/fonts"),
                    to: "fonts"
                },
                {
                    from: path.resolve(__dirname, "assets/logo.png"),
                    to: "assets/logo.png"
                },
                {
                    from: path.resolve(__dirname, "assets/sidebar-logo.png"),
                    to: "assets/sidebar-logo.png"
                },
                {
                    from: path.resolve(__dirname, "assets"),
                    to: "assets",
                    noErrorOnMissing: true
                },
                {
                    from: path.resolve(__dirname, "src/renderer/docs"),
                    to: "docs",
                    noErrorOnMissing: true
                }
            ]
        })
    ]
};