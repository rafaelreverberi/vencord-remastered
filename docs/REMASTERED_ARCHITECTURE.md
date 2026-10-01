# Vencord Remastered architecture

## Audit baseline (1 October 2026)

Vencord upstream: `7f0c10cc29fd789f2f4828ae3dc947623e837920`.
Official installer: `fe6e041a550b01d1853db6c8ea157d42c7480510` from
<https://github.com/Vendicated/VencordInstaller> (canonical project also available at
<https://github.com/Vencord/Installer>). GPL-3.0 licensing permits adapting its
patch format and discovery rules; attribution accompanies the launcher implementation.

Read `scripts/build/common.mjs`, `scripts/build/build.mjs`, `scripts/runInstaller.mjs`,
`src/main/{patcher,settings,ipcMain,ipcPlugins}.ts`, `src/main/updater`,
`src/main/utils/constants.ts`, `src/preload`, `src/api/Settings.ts`, `src/plugins`,
`src/plugins/_core/settings.tsx`, `src/plugins.ts`, and all existing workflows.
`src/userplugins` is absent in a fresh checkout and is deliberately generated.

Current package.json specifies pnpm 11.9.0 and Node >=22. The older
`scripts/checkNodeVersion.js` guard only checks >=18; package.json is authoritative.
Upstream CI uses Node 24. Re-read package.json on every build, rather than freezing
these requirements into launcher source. The launcher ships Electron (including
Node) and dugite's Git distribution; it acquires the exact requested pnpm package
from npm, verifies its registry SHA512 integrity, and runs it with bundled Node.
An incompatible future Node requirement fails before installation changes.

`globPlugins` in common.mjs scans `_api`, `_core`, official plugins and userplugins.
A directory needs index.ts/tsx; plugin names must follow upstream's literal
`definePlugin({ name: "…" })` convention. The native glob scans native.ts and
native/index.ts in official/user plugins. Dependencies resolve in Vencord's workspace;
plugin package manifests and install scripts are never executed. A plugin with imports
not supplied by Vencord fails compilation with a visible diagnostic.

Desktop output includes patcher.js, preload.js, renderer.js, renderer.css and source
maps/legal notices. Vencord's patcher installs preload hooks, loads the original
Discord app, and supports Discord host-update persistence on Windows/Linux.
The official ASAR loader requires an absolute path to patcher.js; the launcher
preserves that format, redirects it to a stable launcher loader, and never fetches
Vencord's generic prebuilt releases.

Settings use VENCORD_USER_DATA_DIR, then DISCORD_USER_DATA_DIR/../VencordData, then
Electron userData/../Vencord. Renderer and native settings are separate JSON files;
quick CSS and themes also live there. The launcher never resets these directories.
Enable/disable controls write only plugins[name].enabled while Discord is closed;
inside Discord the normal Vencord plugin controls remain authoritative. Required
plugins cannot be disabled. Recovery exclusion is a distinct bundle operation.

Official documentation: <https://docs.vencord.dev/installing/custom-plugins/>,
<https://docs.vencord.dev/plugins/native/>. Custom plugins require rebuilding.
Electron isolation and deep links: <https://www.electronjs.org/docs/latest/tutorial/security>
and <https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app>.

## Repository boundaries and upstream maintenance

Use two repositories: rafaelreverberi/vencord-remastered preserves the complete
Vencord history; rafaelreverberi/vencord-remastered-launcher contains the desktop
application. This avoids launcher dependency/configuration collisions with upstream.
The launcher directory in this development workspace is a separate Git repository,
excluded locally from the fork, and is not part of Vencord's source distribution.

Minimal fork integration: `src/remastered` contains the native/client integration;
`src/plugins/remastered.discordDesktop` registers it as a normal required desktop plugin, with a
native re-export. The desktop suffix excludes the integration from web/other hosts. No upstream core file needs modification. All official plugins
and APIs are retained. Builds pass `--disable-updater` so neither git nor HTTP
updater registers update handlers. Remastered adds its own settings entry and a
single update check when the settings panel opens. There is no timer/background daemon.

The launcher source remotes are origin=Remastered and upstream=Vendicated/Vencord.
Normal user updates fast-forward origin/main, already validated by server-side sync.
The launcher fetches upstream for diagnostics but does not make unvalidated upstream
merges on user machines. This centralizes conflict resolution in the maintained fork.
The scheduled/manual sync workflow merges upstream/main in a disposable CI checkout,
validates, then does an ordinary push only on success; conflicts preserve main and
upload conflict diagnostics. No force push, automatic resolution, issue or PR.

## Persistent state

Electron app.getPath('userData') with app name Vencord Remastered:

```
plugins/<opaque-id>/             canonical immutable source snapshots
plugin-metadata.json            repository, branch, commit, name, inclusion state
source/                         replaceable Remastered clone
builds/<content-key>/            validated immutable desktop bundles + manifest
cache/pnpm/<version>/            integrity-verified package manager
state.json                      installed targets, active manifest, diagnostics
loader.cjs                      stable loader pointing at active validated build
```

Vencord settings remain in the normal upstream data directory. User-configurable
settings location supports existing environment overrides. No plugin code or Git
hooks run during ingestion. Local folders are copied and do not depend on originals.
The source checkout and build output are disposable; plugins and Vencord settings
are sufficient to recreate the user's installation.

## Build and publication transaction

Serialize all mutations in the launcher main process; single-instance lock prevents
multiple launchers racing. Persistent JSON files are replaced by same-directory
rename. Reject malformed metadata and symlinks/special files in imported trees.
Single nested plugin roots are detected without executing code. Desktop target suffixes
are preserved; incompatible web/vesktop/dev-only targets are rejected.
Only HTTPS Git URLs without credentials are accepted; Git uses an empty config,
disabled hooks, no submodules, no credential helpers or filters, and safe argv.
Git snapshots are checked out without invoking repository shell scripts.

Before building: verify a clean source, dependency lock/config digest and bundled Node
compatibility; prepare userplugins deterministically from canonical plugin snapshots.
New plugins are seeded disabled in Vencord settings unless the user explicitly enables
them; existing plugin settings are retained. Exclusion from the build helps compile
recovery and does not delete plugin source or its settings. Safe mode stages no plugins.
Duplicate official/user plugin names are rejected before bundling.

Install locked Vencord dependencies with lifecycle scripts disabled; esbuild uses its
platform optional binary. Build using upstream's fixed build command with updater
disabled. Vencord source is trusted maintainer code; third-party repositories never
supply install/build commands. Cache key covers source hash, actual plugin content
hashes, include state, safe mode, Node, pnpm and build configuration. Cache hits are
verified against file hashes; changed plugin source yields a new key.

Build into source/dist, then copy into a new build staging directory. Validate required
files, disabled-updater banner and JS syntax without evaluating plugin code; record all
file hashes and immutable manifest. Rename staging to final build only after success.
A failed build leaves the active loader and Discord ASAR untouched. Diagnostics include
build output and source plugin paths; UI offers exclusion/removal/retry/safe mode.

Electron ASAR virtualization must be bypassed with original-fs for patch operations.
Before patching, require Discord to be closed. On macOS, the app declares
NSAppBundlesUsageDescription; App Management approval is an OS-owned requirement.
Permission failures explain how to open System Settings without changing permissions. Prepare ASAR and loader in temporary
files, journal the transaction, retain original ASAR and previous loader, and publish
with rollback on error. The stable loader resolves a validated immutable bundle;
this also permits the upstream Discord host-update persistence hook to reuse it.
An interrupted transaction is recovered on the next launcher open before operations.
Do not remove old builds automatically: they provide rollback and running-process safety.
Linux system Electron unpacked archives and Flatpak access are handled explicitly;
read-only system installs report permission failures without silently escalating.

## Update and recovery

Plugin Update/Update All: clone new revision into temporary persistent storage,
validate entrypoint/tree, switch metadata/source snapshot, rebuild once and repatch.
Failed compilation leaves current installation active. The new plugin source remains
available for diagnosis; exclude it and Apply Changes, or safe mode. Removing a plugin
removes metadata after a successful state write; settings are deliberately preserved.
Missing/corrupt source: quarantine it, clone Remastered anew, restore generated plugins,
install dependencies, build and patch. Canonical plugins are never under source/.
Repair reinstalls dependencies and bypasses the build cache. Safe mode retains all
canonical sources, metadata and settings and records the temporary bundle mode.

Client native APIs accept no commands, executable paths or URLs from Discord renderer.
They check a fixed GitHub origin/main endpoint for availability and open only
`vencord-remastered://update`. The OS launches the app on demand. This URL only opens
an update review in the launcher; it does not install code automatically. Parsing
rejects every other host/path/query/credentials. Launcher IPC accepts only allowlisted
operations from its own top-level local window; sandboxed renderer cannot spawn or
access arbitrary files. A native folder picker supplies local plugin paths.

Launcher self-update uses electron-updater and separately published launcher releases,
with download/install controls. It preserves userData and Vencord settings. Release
artifacts include GPL sources via public repositories, licenses and Git attribution.
Code signing/notarization requires real publisher credentials and is documented rather
than represented as completed when unavailable.

## Verification boundaries

Automated tests exercise real filesystem persistence, Git snapshots, staging, hashes,
settings preservation, ASAR loader compatibility, rollback, recovery and malformed input.
A fresh managed checkout integration builds real Vencord with multiple sample plugins,
checks cache reuse, compilation failure preserving the loader, safe mode, and source
recreation. Real Discord execution and each OS's packaged app require host-specific
smoke verification; fixture ASAR checks alone do not prove Discord UI/plugin rendering.
Verified on the development macOS arm64 host: a packaged launcher detected and
patched real Discord; a Git sample plugin was imported, persisted, built and patched,
appeared in normal Vencord settings, and was enabled/disabled in-client. The Remastered
settings page loaded and its fixed update link opened the launcher. Existing settings
remained available. Direct Finder-launched writes exposed macOS App Management
requirements, handled explicitly in the app. See launcher docs/TESTING.md and
VALIDATION.md for actual evidence and remaining gaps.
