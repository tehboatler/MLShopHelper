# MLShopHelper

MLShopHelper is a collaborative, crowdsourced price tracker and inventory datasheet for MapleLegends items. It empowers the community to track, analyze, and share item prices and shop inventories in real time—without collecting any personal user information.

## What Makes It Unique?
- **Crowdsourced Data:** Anyone can submit prices and sales for items. The app aggregates data from all users, making it a living, up-to-date price reference for the MapleLegends economy.
- **No Personal Info Required:** Logins are managed by a secret key. You never need to provide email, Discord, or any personal details.
- **Multi-User Collaboration:** See price histories and trends based on the collective input of all users. Your submissions help everyone!
- **Modern, Fast UI:** Built with Tauri 2.x, React, and TypeScript for a smooth, desktop-native experience.

## Key Features
- **Inventory Management:** Add, edit, and organize shop items. Track stock counts per character or storage.
- **Price History Tracking:** View detailed price history for each item, with both an expanded and minimal view.
- **Minimalist Notifications:** Simple, bold notifications for key events. Dismiss by clicking or pressing Escape.
- **Probability Calculators:** Estimate your chances and budgets for item upgrades, with hotkeys and detailed stats.
- **Price Analytics:** See boxplot charts and statistics for item prices, including outlier filtering and budgeting confidence levels.
- **Hotkeys:** Quickly toggle views, reset calculators, or exit modals using keyboard shortcuts (e.g., Ctrl+R, Escape).

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/prerequisites/#installing-tauri-cli)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows only)

### Installation
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

### Running the App
To start in development mode (with hot reload):
```sh
npm run tauri dev
# or
yarn tauri dev
```

### Building for Production
To build for distribution:
```sh
npm run tauri build
# or
yarn tauri build
```
Output is in `src-tauri/target/release/bundle`.

## Usage Tips
- **Switch View Modes:** Use the toggle in the title bar or a hotkey to switch between expanded and minimal price history views.
- **Notifications:** Dismiss notifications by clicking anywhere or pressing Escape.
- **Calculator Hotkeys:** Use Ctrl+R to reset the scroll probability calculator.
- **No Fake Data:** All data is real and user-contributed. No mock data is ever shown.

## Troubleshooting
- For native module errors, ensure Visual Studio Build Tools are installed with C++ workload.
- For Rust/Tauri issues, see the [Tauri docs](https://tauri.app/v2/docs/).

## Project Structure
- `src/` – React frontend
- `src-tauri/` – Rust backend (Tauri)
- `mergeInventoryDb.ts` – Utility for merging inventory databases

## License
MIT
