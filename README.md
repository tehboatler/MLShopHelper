# MLShopHelper

![MLShopHelper Header](public/MLSHHeader.png)

MLShopHelper is a collaborative, crowdsourced price tracker and inventory datasheet for MapleLegends items. It empowers the community to track, analyze, and share item prices and shop inventories in real time. All you have to do is log the items you sell and the price you sell them for. The app will handle the rest.

## What Makes It Unique?
- **Crowdsourced Data:** Anyone can submit prices and sales for items. The app aggregates data from all users, making it a living, up-to-date price reference for the ML community.
- **No Personal Info Required:** Logins are managed by a secret key. You never need to provide email, Discord, or any personal details.
- **Modern, Fast UI:** Built with Tauri 2.x, React, and TypeScript for a smooth, desktop-native experience.
- **Filtering by Friends:** Filter items by friends who sell them if you only want to see prices from trusted contributors. (coming soon)
- **Admin-Only Item Management:** Only users with the `admin` label can add new items to the global item list.

## Key Features
- **Inventory Management:** Add, edit, and organize shop items. Track stock counts and potential store sale value.
- **Price History Tracking:** View detailed box-plot 30d price history for each item.
- **Price Analytics:** See boxplot charts and statistics for item prices, including outlier filtering.
- **Hotkeys:** Searching, Adding Items to Store and Selling Items without touching the mouse.
- **Shop Uptime Tracking:** Set timers for monitoring shop uptime, with automatic closure after 24 hours. Supports tracking multiple shops concurrently, with data displayed in the dashboard.

![MLShopHelper in action](public/MLShopHelper.gif)
![Shop Restocking Showcase](public/MLShopHelperShopStockShowcase.gif)

## Known Limitations & Validation Checklist

- [ ] **Code Signing:** Deferred as the project is in the validation phase. Transparency is ensured via provenance and open-source code. (Code signing costs are currently exorbitant & prohibitive.)
- [ ] **Downvoting Feature:** The downvoting mechanism for flagging inaccurate sales data is incomplete and may not function reliably.
- [ ] **Adding/Filtering/Managing Friends:** Adding and filtering by friends is incomplete and may have usability pitfalls.
- [ ] **Fuzzy Search Limitations:** Items with unconventional names may yield suboptimal matches. Please report issues via GitHub Issues.
- [ ] **Boxplot and Price History Display:** Tested only on 2–3 days of data. 30d history and data management need more practical testing.
- [ ] **Other Usability Pitfalls:** Various other usability issues may exist as the app is still being validated.

## Trust and Security

As an indie dev, I know running a third-party .exe can raise questions. Here’s why MLShopHelper is safe:

- **Open-Source**: The code is public. Check it out or build it yourself!
- **SLSA Provenance**: GitHub Actions verifies the .exe matches and is built directly from the source code. Verify with GitHub CLI. (see releases for instructions)
- **VirusTotal Scan**: Releases are scanned clean by major antivirus engines: report. **I encourage you to rescan it yourself** for peace of mind.
- **SHA-256 Checksum**: Confirm integrity with:

    ```
    SHA-256: 34f982a5688bd4bc5d487b715ab101063edeaeb70dfb7d5b7194a11def99830a
    ```
- **Unsigned .exe**: As a solo dev in beta, I’m skipping code signing to save costs. Provenance and scans ensure transparency.

For full details, see the notes attached to each release.

## Getting Started

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri CLI](https://tauri.app/v2/guides/getting-started/prerequisites/#installing-tauri-cli)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows only)
- [Bun](https://bun.sh/) (instead of npm/yarn)

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
3. **Environment Variables:**
   - Copy `.env.example` to `.env`:
     ```sh
     cp .env.example .env
     ```
   - Edit `.env` and fill in your own [Appwrite](https://appwrite.io/) project details:
     - `VITE_APPWRITE_ENDPOINT`: Your Appwrite API endpoint (e.g., https://cloud.appwrite.io/v1)
     - `VITE_APPWRITE_PROJECT`: Your Appwrite project ID
     - `VITE_APPWRITE_DATABASE`: Your Appwrite database ID
     - `VITE_APPWRITE_ITEMS_COLLECTION`: Your items collection ID
     - `VITE_APPWRITE_ANON_LINKS_COLLECTION`: Your anon_links collection ID
     - `VITE_APPWRITE_PRICE_HISTORY_COLLECTION`: Your price_history collection ID
     - `VITE_APPWRITE_STATS_COLLECTION`: Your itemStats collection ID
     - `VITE_APPWRITE_VERSION_COLLECTION`: Your current_app_version collection ID
     - `VITE_APP_VERSION`: The app version (set to match your build/release)
   - **Note:** You must have your own Appwrite instance or use [Appwrite Cloud](https://cloud.appwrite.io/). See the [Appwrite documentation](https://appwrite.io/docs) for details on setting up a backend and creating projects/collections.

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

## 📦 Appwrite Collections & Schema

Below are the required Appwrite collections and their expected attribute schemas. Expand each section for details:

<details>
<summary><strong>Items Collection</strong></summary>

<p><em>Purpose:</em> Stores all items that users can add to their shop inventory, including item name, price, notes, and ownership status.</p>

<p><strong>Important:</strong> The <strong>Add Item</strong> feature is restricted to users with the <code>admin</code> label on the built-in Appwrite users collection. Only admins can add new items to the global item list.</p>

```json
{
  "name": "items",
  "attributes": [
    { "key": "name", "type": "string", "required": true },
    { "key": "price", "type": "integer", "required": true },
    { "key": "notes", "type": "string", "required": false },
    { "key": "owned", "type": "boolean", "required": false }
  ]
}
```
<p><strong>Recommended Permissions:</strong> Allow only users with the <code>admin</code> label to create new items. Read access can be open to all authenticated users. Updates/deletes should be restricted to admins or the original creator if you allow item editing.</p>
</details>

<details>
<summary><strong>Price History Collection</strong></summary>

<p><em>Purpose:</em> Tracks all price submissions and sales for each item, including who submitted the price, when, and if the item was sold. Used for analytics and price history charts.</p>

```json
{
  "name": "price_history",
  "attributes": [
    { "key": "itemId", "type": "string", "required": true },
    { "key": "price", "type": "integer", "required": true },
    { "key": "date", "type": "string", "format": "ISO8601", "required": true },
    { "key": "author", "type": "string", "required": true },
    { "key": "author_ign", "type": "string", "required": false },
    { "key": "sold", "type": "boolean", "required": false },
    { "key": "downvotes", "type": "array", "required": false },
    { "key": "item_name", "type": "string", "required": false },
    { "key": "notes", "type": "string", "required": false }
  ]
}
```
<p><strong>Recommended Permissions:</strong> Allow any authenticated user to create new price entries. Read access can be open to all users for community transparency. Only allow updates/deletes by the original author or admins.</p>
</details>

<details>
<summary><strong>Invites Collection</strong></summary>

<p><em>Purpose:</em> Manages invite codes for onboarding new users, tracking who created and used each invite, and the invite status (redeemed, unredeemed, expired).</p>

```json
{
  "name": "invites",
  "attributes": [
    { "key": "code", "type": "string", "required": true },
    { "key": "createdBy", "type": "string", "required": true },
    { "key": "usedBy", "type": "string", "required": false },
    { "key": "status", "type": "enum", "elements": ["redeemed", "unredeemed", "expired"], "required": true },
    { "key": "createdAt", "type": "string", "format": "ISO8601", "required": true },
    { "key": "usedAt", "type": "string", "format": "ISO8601", "required": false }
  ]
}
```
<p><strong>Recommended Permissions:</strong> Allow creation by authenticated users. Read access can be restricted to the creator and admins. Only allow updates by the system or admins to prevent abuse.</p>
</details>

<details>
<summary><strong>Anon Links Collection</strong></summary>

<p><em>Purpose:</em> Stores anonymous user links and in-game names (IGNs), as well as whitelists for friend filtering and secret keys for authentication.</p>

```json
{
  "name": "anon_links",
  "attributes": [
    { "key": "userId", "type": "string", "required": true },
    { "key": "user_ign", "type": "string", "required": false },
    { "key": "secret", "type": "string", "required": true },
    { "key": "whitelist", "type": "array", "required": false }
  ]
}
```
<p><strong>Recommended Permissions:</strong> Allow each user to create and update their own document. Read access can be restricted to the user and admins. Whitelist management should only be allowed by the document owner.</p>
</details>

<details>
<summary><strong>Item Stats Collection</strong></summary>

<p><em>Purpose:</em> Stores computed statistics (median, average, percentiles, count, last update time) for each item, used to power analytics and summary displays.</p>

```json
{
  "name": "itemStats",
  "attributes": [
    { "key": "itemId", "type": "string", "required": true },
    { "key": "median", "type": "double", "required": true },
    { "key": "avg", "type": "double", "required": true },
    { "key": "p25", "type": "double", "required": true },
    { "key": "p75", "type": "double", "required": true },
    { "key": "count", "type": "integer", "required": true },
    { "key": "updatedAt", "type": "datetime", "required": true }
  ]
}
```
<p><strong>Recommended Permissions:</strong> Usually only the backend or trusted admins should be able to update item stats. Read access should be open to all users for analytics.</p>
</details>

<details>
<summary><strong>Current App Version Collection</strong></summary>

<p><em>Purpose:</em> Used for version gating—stores the current required app version so clients can check if they are up-to-date or need to upgrade.</p>

```json
{
  "name": "current_app_version",
  "attributes": [
    { "key": "build_version", "type": "string", "required": true }
  ]
}
```
<p><strong>Recommended Permissions:</strong> Only admins or automated deployment should update this collection. Read access should be open to all clients so they can check the current version.</p>
</details>

---

### How to Use

- When setting up your Appwrite backend, create collections with the above attribute schemas and purposes in mind.
- <strong>Permissions are critical:</strong> For each collection, configure read/write/update/delete permissions according to the recommendations above. This usually means allowing users to access their own data, and only admins or the backend to update global or sensitive data.
- Attribute types and requirements must match for the app to work correctly.
- Adjust collection names/IDs as needed, but update your `.env` accordingly.

## License
MIT
