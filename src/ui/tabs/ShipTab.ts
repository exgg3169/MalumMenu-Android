import { add, Layout, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { Theme } from "../../data/LayoutConfig";
import { ModuleManager } from "../../core/ModuleManager";
import { ShipModule } from "../../modules/Ship";
import { Widgets } from "../Widgets";

export class ShipTab {
    static draw(layout: ObsidianLayout, page: Layout) {
        const ship = () => ModuleManager.get(ShipModule);
        const button = (key: string, action: () => void) =>
            add(Widgets.card(layout.button(I18n.t(key), Widgets.action(I18n.t(key), action)), Theme.cardPressed), page);
        const toggle = (key: string, onChange: (state: boolean) => void) => add(Widgets.card(layout.toggle(I18n.t(key), onChange)), page);

        add(Widgets.header(I18n.t("menu.sections.meetings")), page);
        button("menu.functions.call_meeting", () => ship()?.callMeeting());

        add(Widgets.header(I18n.t("menu.sections.sabotage")), page);
        button("menu.functions.open_sabotage_map", () => ship()?.openSabotageMap());
        button("menu.functions.sabotage_reactor", () => ship()?.sabotageReactor());
        button("menu.functions.sabotage_oxygen", () => ship()?.sabotageOxygen());
        button("menu.functions.sabotage_comms", () => ship()?.sabotageComms());
        button("menu.functions.sabotage_lights", () => ship()?.sabotageLights());
        button("menu.functions.repair_sabotages", () => ship()?.repairSabotages());

        add(Widgets.header(I18n.t("menu.sections.vents")), page);
        toggle("menu.functions.unlock_vents", state => (State.unlockVents = state));
        toggle("menu.functions.walk_in_vents", state => (State.walkInVents = state));
        button("menu.functions.kick_vents", () => ship()?.kickVents());
    }
}
