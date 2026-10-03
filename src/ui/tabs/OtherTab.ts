import { add, Layout, ObsidianLayout, sharedPreferences, toast } from "frida-java-menu";

import { I18n } from "../../i18n/I18n";
import { JavaUtils } from "../../utils/JavaUtils";
import { Constants } from "../../data/Constants";
import { Theme } from "../../data/LayoutConfig";
import { Widgets } from "../Widgets";

export class OtherTab {
    static draw(layout: ObsidianLayout, page: Layout) {
        const link = (key: string, url: string) =>
            add(
                Widgets.card(
                    layout.button(I18n.t(key), () => JavaUtils.openURL(url)),
                    Theme.cardPressed
                ),
                page
            );

        add(Widgets.header(I18n.t("menu.sections.language")), page);
        add(
            Widgets.card(
                layout.radioGroup(I18n.t("menu.other.language"), I18n.getLocalisedLanguages(), (index: number) => {
                    const selectedLocale = I18n.supportedLocales[index];
                    I18n.changeLocale(selectedLocale);
                    toast(I18n.t("menu.toasts.on_locale_changed", I18n.getLocalisedLanguages()[index]), 0);
                })
            ),
            page
        );

        add(Widgets.header(I18n.t("menu.sections.links")), page);
        link("menu.other.github_url", Constants.GITHUB_URL);
        link("menu.other.discord_url", Constants.DISCORD_URL);
        link("menu.other.malummenu_url", Constants.MALUMMENU_URL);
        link("menu.other.changelog", Constants.GITHUB_CHANGELOG_URL);

        add(Widgets.header(I18n.t("menu.sections.settings")), page);
        add(
            Widgets.card(
                layout.button(
                    I18n.t("menu.other.reset_settings"),
                    () => toast(I18n.t("menu.toasts.long_press_to_confirm"), 0),
                    () => {
                        sharedPreferences.clear();
                        toast(I18n.t("menu.toasts.settings_reset"), 1);
                    }
                ),
                Theme.danger
            ),
            page
        );
    }
}
