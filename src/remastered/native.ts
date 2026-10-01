/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { net, shell } from "electron";

export async function latestCommit() {
    const response = await net.fetch("https://api.github.com/repos/rafaelreverberi/vencord-remastered/commits/main", {
        headers: { Accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Update check failed (${response.status})`);
    const data = await response.json();
    if (!/^[a-f0-9]{40}$/.test(data.sha)) throw new Error("Invalid update response");
    return data.sha as string;
}

export function openLauncher() {
    return shell.openExternal("vencord-remastered://update");
}
