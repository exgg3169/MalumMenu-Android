import { add, Layout, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { UwUifyModule } from "../../modules/UwUify";
import { UnityUtils } from "../../utils/UnityUtils";
import { ModuleManager } from "../../core/ModuleManager";
import { PassiveModule } from "../../modules/Passive";
import { Widgets } from "../Widgets";

export class PassiveTab {
    static draw(layout: ObsidianLayout, page: Layout) {
        const passive = () => ModuleManager.get(PassiveModule);
        const toggle = (key: string, onChange: (state: boolean) => void) => add(Widgets.card(layout.toggle(I18n.t(key), onChange)), page);

        add(Widgets.header(I18n.t("menu.sections.account")), page);
        toggle("menu.functions.unlock_cosmetics", state => (State.unlockCosmetics = state));
        toggle("menu.functions.disable_analytics", state => (State.disableAnalytics = state));

        add(Widgets.header(I18n.t("menu.sections.graphics")), page);
        toggle(
            "menu.functions.full_resolution",
            UnityUtils.run((state: boolean) => passive()?.toggleFullResolution(state))
        );

        const fpsLabel = I18n.t("menu.functions.fps_val");
        State.fps = Widgets.savedInt(fpsLabel, State.fps);
        add(
            Widgets.seekbar(
                layout,
                fpsLabel,
                120,
                30,
                UnityUtils.run((value: number) => {
                    State.fps = value;
                    if (State.fpsUnlock) passive()?.applyFrameRate();
                })
            ),
            page
        );
        toggle(
            "menu.functions.fps_unlock",
            UnityUtils.run((state: boolean) => {
                State.fpsUnlock = state;
                passive()?.applyFrameRate();
            })
        );

        add(Widgets.header(I18n.t("menu.sections.fun")), page);
        toggle(
            "menu.functions.uwuify",
            UnityUtils.run((state: boolean) => {
                State.uwuifyMode = state;
                ModuleManager.get(UwUifyModule)?.toggleUwUify(state);
            })
        );

        add(Widgets.header(I18n.t("menu.sections.input")), page);
        toggle("menu.functions.keyboard_mode", state => (State.keyboardMode = state));
        add(Widgets.note(I18n.t("menu.functions.keyboard_mode_note")), page);
    }
}
