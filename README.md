# MLShopHelper

MLShopHelper is a desktop application built with Tauri, React, and Typescript. It provides inventory and price management tools for shopkeepers, leveraging a local SQLite database and a modern UI.

## Features
- Inventory management
- Price history tracking
- Fast local database (SQLite)
- Cross-platform (Windows, macOS, Linux)

## Prerequisites (Windows)

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or newer recommended)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/prerequisites/#installing-tauri-cli):
  ```sh
  cargo install tauri-cli
  ```
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (for building native modules; select "Desktop development with C++")

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/MLShopHelper.git
   cd MLShopHelper
   ```

2. **Install dependencies:**
   ```sh
   npm install
   # or
   yarn install
   ```

## Running in Development Mode

To start the app in development mode (with hot reload):
```sh
npm run tauri dev
# or
yarn tauri dev
```

## Building for Production (Windows)

To build the app for distribution:
```sh
npm run tauri build
# or
yarn tauri build
```
The output can be found in the `src-tauri/target/release/bundle` directory.

## Troubleshooting
- If you encounter errors related to native modules, ensure you have installed the Visual Studio Build Tools with the correct C++ workload.
- For Rust or Tauri issues, see the [Tauri documentation](https://tauri.app/v2/docs/).

## Project Structure
- `src/` – React frontend
- `src-tauri/` – Rust backend (Tauri)
- `mergeInventoryDb.ts` – Utility for merging inventory databases

## License
MIT
