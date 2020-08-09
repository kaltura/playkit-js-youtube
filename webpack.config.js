"use strict";

const webpack = require("webpack");
const path = require("path");
const PROD = process.env.NODE_ENV === "production";
const packageData = require("./package.json");

const plugins = [
  new webpack.DefinePlugin({
    __VERSION__: JSON.stringify(packageData.version),
    __NAME__: JSON.stringify(packageData.name),
  }),
];

module.exports = {
  context: __dirname + "/src",
  entry: { "playkit-youtube": "index.js" },
  output: {
    path: __dirname + "/dist",
    filename: "[name].js",
    library: ["playkit", "youtube"],
    libraryTarget: "umd",
    devtoolModuleFilenameTemplate: "./youtube/[resource-path]",
  },
  devtool: "source-map",
  plugins: plugins,
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: "babel-loader",
          },
        ],
        exclude: [/node_modules/],
      },
      {
        test: /\.js$/,
        exclude: [/node_modules/],
        enforce: "pre",
        use: [
          {
            loader: "eslint-loader",
            options: {
              rules: {
                semi: 0,
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
        ],
      },
    ],
  },
  devServer: {
    contentBase: __dirname + "/src",
  },
  resolve: {
    modules: [path.resolve(__dirname, "src"), "node_modules"],
  },
  optimization: {
    minimize: PROD,
  },
  externals: {
    "@playkit-js/playkit-js": {
      commonjs: "@playkit-js/playkit-js",
      commonjs2: "@playkit-js/playkit-js",
      amd: "playkit-js",
      root: ["KalturaPlayer", "core"],
    },
  },
};
