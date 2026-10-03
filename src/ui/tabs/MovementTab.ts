import { add, Layout, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { Widgets } from "../Widgets";

export class MovementTab {
    static draw(layout: ObsidianLayout, page: Layout) {
        add(Widgets.header(I18n.t("menu.sections.collision")), page);
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.noclip"), (state: boolean) => {
                    State.noclip = state;
                })
            ),
            page
        );

        add(Widgets.header(I18n.t("menu.sections.speed")), page);
        const speedLabel = I18n.t("menu.functions.speed_val");
        State.speed = Widgets.savedInt(speedLabel, State.speed);
        add(
            Widgets.seekbar(layout, speedLabel, 20, 1, (value: number) => {
                State.speed = value;
            }),
            page
        );
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.custom_speed"), (state: boolean) => {
                    State.customSpeed = state;
                })
            ),
            page
        );

        add(Widgets.header(I18n.t("menu.sections.game_speed")), page);
        const gameSpeedLabel = I18n.t("menu.functions.game_speed_val");
        State.gameSpeed = Widgets.savedInt(gameSpeedLabel, State.gameSpeed);
        add(
            Widgets.seekbar(layout, gameSpeedLabel, 5, 1, (value: number) => {
                State.gameSpeed = value;
            }),
            page
        );
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.game_speed"), (state: boolean) => {
                    State.gameSpeedEnabled = state;
                })
            ),
            page
        );
    }
}
