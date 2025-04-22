# MLShopHelper

![MLShopHelper Header](public/MLSHHeader.png)

MLShopHelper is a collaborative, crowdsourced price tracker and inventory datasheet for MapleLegends items. It empowers the community to track, analyze, and share item prices and shop inventories in real time. All you have to do is log the items you sell and the price you sell them for. The app will handle the rest.

## What Makes It Unique?
- **Crowdsourced Data:** Anyone can submit prices and sales for items. The app aggregates data from all users, making it a living, up-to-date price reference for the ML community.
- **No Personal Info Required:** Logins are managed by a secret key. You never need to provide email, Discord, or any personal details.
- **Modern, Fast UI:** Built with Tauri 2.x, React, and TypeScript for a smooth, desktop-native experience.
- **Filtering by Friends:** Filter items by friends who sell them if you only want to see prices from trusted contributors.

## Key Features
- **Inventory Management:** Add, edit, and organize shop items. Track stock counts and potential store sale value.
- **Price History Tracking:** View detailed box-plot 30d price history for each item.
- **Price Analytics:** See boxplot charts and statistics for item prices, including outlier filtering.
- **Hotkeys:** Searching, Adding Items to Store and Selling Items without touching the mouse (e.g., Ctrl+R, Escape).

![MLShopHelper in action](public/MLShopHelper.gif)

## Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/prerequisites/#installing-tauri-cli)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows only)

### Installation
1. **Clone the repository:**
   ```sh
   git clone https://github.com/tehboatler/MLShopHelper.git
   cd MLShopHelper
   ```
2. **Install dependencies:**
   ```sh
   bun install
   ```

### Running the App
To start in development mode (with hot reload):
```sh
bun run tauri dev
```

### Building for Production
To build for distribution:
```sh
bunx tauri build
```
Output is in `src-tauri/target/release/`.

## License
MIT
