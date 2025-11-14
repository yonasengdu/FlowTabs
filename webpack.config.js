const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',

  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
      
        use: [
          {
            loader: 'ts-loader',
            options: {
    
              configFile: path.resolve(__dirname, 'tsconfig.json')
            }
          }
        ],
      
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [{ from: 'public', to: '.' }],
    }),
  ],
};