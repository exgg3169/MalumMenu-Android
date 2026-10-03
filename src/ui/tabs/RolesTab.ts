import { add, Layout, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { Theme } from "../../data/LayoutConfig";
import { ModuleManager } from "../../core/ModuleManager";
import { PlayerModule } from "../../modules/Player";
import { State } from "../../data/State";
import { Widgets } from "../Widgets";

export class RolesTab {
    static draw(layout: ObsidianLayout, page: Layout) {
        add(Widgets.header(I18n.t("menu.sections.tasks")), page);
        add(
            Widgets.card(
                layout.button(
                    I18n.t("menu.functions.complete_my_tasks"),
                    Widgets.action(I18n.t("menu.functions.complete_my_tasks"), () => ModuleManager.get(PlayerModule)?.completeMyTasks())
                ),
                Theme.cardPressed
            ),
            page
        );

        add(Widgets.header(I18n.t("menu.sections.impostor")), page);
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.kill_reach"), (state: boolean) => {
                    State.killReach = state;
                })
            ),
            page
        );
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.kill_anyone"), (state: boolean) => {
                    State.killAnyone = state;
                })
            ),
            page
        );
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.no_kill_cd"), (state: boolean) => {
                    State.noKillCd = state;
                })
            ),
            page
        );
        add(
            Widgets.card(
                layout.button(
                    I18n.t("menu.functions.kill_everyone"),
                    Widgets.action(I18n.t("menu.functions.kill_everyone"), () => ModuleManager.get(PlayerModule)?.killEveryoneAsImpostor())
                ),
                Theme.cardPressed
            ),
            page
        );
        add(Widgets.note(I18n.t("menu.functions.impostor_note")), page);
    }
}
