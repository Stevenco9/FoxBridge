# FoxBridge

Desktop companion for RegFox event management.

## Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm (included with Node.js)

## Install dependencies

```bash
npm install
```

## Run in development

Starts the Vite dev server and launches the Electron window with hot reload:

```bash
npm run dev
```

## Build for production

Compiles TypeScript and bundles the application:

```bash
npm run build
```

## Run the production build

After building, launch the packaged Electron app:

```bash
npm start
```

## Project structure

```
FoxBridge/
├── electron/          # Electron main and preload processes
├── src/               # React renderer (UI)
├── docs/              # Product and development documentation
├── index.html         # Vite entry HTML
├── vite.config.ts     # Vite and Electron build configuration
└── package.json
```

## Documentation

- [Product Requirements](docs/PRODUCT.md)
- [Development Rules](docs/development-rules.md)
