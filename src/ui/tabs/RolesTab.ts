import { add, Layout, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { Theme } from "../../data/LayoutConfig";
import { ModuleManager } from "../../core/ModuleManager";
import { PlayerModule } from "../../modules/Player";
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
    }
}
