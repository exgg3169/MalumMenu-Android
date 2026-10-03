import { ObsidianConfig as ObsCfg, systemAccentColor } from "frida-java-menu";

import { I18n } from "../i18n/I18n";

const accent = systemAccentColor("#E5484D");

export const Theme = {
    accent,
    text: "#F2F4F8",
    mutedText: "#8B93A7",
    card: "#1B1F2A",
    cardPressed: "#252A38",
    tabActive: accent,
    tabInactive: "#20242F",
    divider: "#2A2F3D",
    danger: "#C0392B",
    cornerRadius: 28
} as const;

export const ObsidianConfig: ObsCfg = {
    color: {
        primaryText: Theme.text,
        secondaryText: Theme.text,
        buttonBg: Theme.cardPressed,
        layoutBg: "#12151C",
        collapseBg: Theme.card,
        categoryBg: Theme.card,
        menu: "#0B0D12",
        tabFocusedBg: Theme.cardPressed,
        tabUnfocusedBg: Theme.card,
        hideFg: Theme.mutedText,
        closeFg: accent
    },
    menu: {
        width: 380,
        height: 260,
        x: 100,
        y: 80,
        cornerRadius: 36
    },
    icon: {
        size: 50,
        alpha: 1
    },
    strings: {
        noOverlayPermission: I18n.t("menu.toasts.no_overlay_permission"),
        hide: I18n.t("menu.toasts.hide_button"),
        close: I18n.t("menu.toasts.close_button"),
        hideCallback: I18n.t("menu.toasts.hide_callback"),
        killCallback: I18n.t("menu.toasts.kill_callback")
    }
} as const;
