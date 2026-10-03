import { add, Layout, ObsidianLayout } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { State } from "../../data/State";
import { Widgets } from "../Widgets";

export class ESPTab {
    static draw(layout: ObsidianLayout, page: Layout) {
        add(Widgets.header(I18n.t("menu.sections.vision")), page);
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.no_shadows"), (state: boolean) => {
                    State.noShadows = state;
                })
            ),
            page
        );
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.reveal_impostors"), (state: boolean) => {
                    State.revealImpostors = state;
                })
            ),
            page
        );

        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.see_roles"), (state: boolean) => {
                    State.seeRoles = state;
                })
            ),
            page
        );

        add(Widgets.header(I18n.t("menu.sections.camera")), page);
        const zoomLabel = I18n.t("menu.functions.zoom_val");
        State.zoom = Widgets.savedInt(zoomLabel, State.zoom);
        add(
            Widgets.seekbar(layout, zoomLabel, 6, 1, (value: number) => {
                State.zoom = value;
            }),
            page
        );
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.zoom_out"), (state: boolean) => {
                    State.zoomOut = state;
                })
            ),
            page
        );

        add(Widgets.header(I18n.t("menu.sections.chat")), page);
        add(
            Widgets.card(
                layout.toggle(I18n.t("menu.functions.always_show_chat"), (state: boolean) => {
                    State.alwaysShowChat = state;
                })
            ),
            page
        );
        add(Widgets.note(I18n.t("menu.functions.always_show_chat_note")), page);
    }
}
