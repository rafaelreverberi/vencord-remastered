/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, React, useEffect, useState } from "@webpack/common";

import gitHash from "~git-hash";

const Native = VencordNative.pluginHelpers.Remastered;

export function RemasteredSettings() {
    const [status, setStatus] = useState("Checking for updates…");
    useEffect(() => {
        let mounted = true;
        Native.latestCommit().then((hash: string) => {
            if (mounted) setStatus(hash.startsWith(gitHash) ? "Up to date" : "Update available");
        }).catch(() => {
            if (mounted) setStatus("Update check unavailable. Open the launcher to retry.");
        });
        return () => { mounted = false; };
    }, []);
    return <div>
        <h2>Vencord Remastered</h2>
        <p>Installed revision: {gitHash}</p>
        <p>{status}</p>
        <p>The launcher preserves your third-party plugins and builds your updates.</p>
        <Button onClick={() => Native.openLauncher().catch(() => setStatus("Install or open Vencord Remastered Launcher."))}>
            Update Vencord Remastered
        </Button>
    </div>;
}
