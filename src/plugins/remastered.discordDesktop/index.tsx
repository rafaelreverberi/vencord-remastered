/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { UpdaterIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import definePlugin from "@utils/types";

import { RemasteredSettings } from "../../remastered/Settings";

export default definePlugin({
    name: "Remastered",
    description: "Launcher-managed updates and persistent third-party plugins.",
    authors: [{ name: "rafaelreverberi", id: 0n }],
    required: true,
    start() {
        SettingsPlugin.customEntries.push({
            key: "vencord_remastered",
            title: "Vencord Remastered",
            Component: RemasteredSettings,
            Icon: UpdaterIcon
        });
    },
    stop() {
        const entries = SettingsPlugin.customEntries;
        const index = entries.findIndex(e => e.key === "vencord_remastered");
        if (index !== -1) entries.splice(index, 1);
    }
});
