import Java from "frida-java-bridge";

import { add, Layout, ObsidianLayout, toast } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { Theme } from "../../data/LayoutConfig";
import { JavaUtils } from "../../utils/JavaUtils";
import { UnityUtils } from "../../utils/UnityUtils";
import { Widgets } from "../Widgets";
import { Logger } from "../../logger/Logger";

export class DebugTab {
    static draw(layout: ObsidianLayout, page: Layout) {
        add(Widgets.header(I18n.t("menu.sections.system")), page);

        const info: [string, string][] = [
            ["Frida", `${Frida.version} (${Script.runtime})`],
            ["Unity", Il2Cpp.unityVersion],
            ["Android", Java.androidVersion],
            ["Arch", Process.arch],
            ["Platform", Process.platform],
            ["PID", `${Process.id}`]
        ];
        for (const [label, value] of info) {
            add(Widgets.infoRow(label, value), page);
        }

        add(
            Widgets.card(
                layout.button(I18n.t("menu.other.copy_debug_info"), () => {
                    JavaUtils.copyToClipboard(info.map(([label, value]) => `${label}: ${value}`).join("\n"));
                    toast(I18n.t("menu.toasts.copied"), 0);
                }),
                Theme.cardPressed
            ),
            page
        );

        add(
            Widgets.card(
                layout.button(I18n.t("menu.other.copy_error_log"), () => {
                    const errors = Logger.recentErrors();
                    JavaUtils.copyToClipboard(errors.length ? errors.join("\n") : "No errors");
                    toast(I18n.t("menu.toasts.copied_errors", errors.length), 0);
                }),
                Theme.cardPressed
            ),
            page
        );

        add(Widgets.header(I18n.t("menu.sections.game")), page);
        add(
            Widgets.card(
                layout.button(I18n.t("menu.functions.go_to_main_menu"), () => {
                    UnityUtils.LoadScene("MainMenu");
                }),
                Theme.cardPressed
            ),
            page
        );

        add(
            Widgets.card(
                layout.button(
                    I18n.t("menu.functions.exit_game"),
                    () => {
                        toast(I18n.t("menu.toasts.exit_game"), 0);
                    },
                    () => {
                        JavaUtils.exitFromApp();
                    }
                ),
                Theme.danger
            ),
            page
        );
    }
}
