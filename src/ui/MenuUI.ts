import Java from "frida-java-bridge";

import { ObsidianLayout, waitForInit, Composer, Layout, add, sharedPreferences } from "frida-java-menu";

import { Constants } from "../data/Constants";
import { ObsidianConfig } from "../data/LayoutConfig";

import { I18n } from "../i18n/I18n";

import { Logger } from "../logger/Logger";

import { Widgets } from "./Widgets";

import { DebugTab } from "./tabs/DebugTab";
import { MovementTab } from "./tabs/MovementTab";
import { ESPTab } from "./tabs/ESPTab";
import { RolesTab } from "./tabs/RolesTab";
import { ShipTab } from "./tabs/ShipTab";
import { PassiveTab } from "./tabs/PassiveTab";
import { OtherTab } from "./tabs/OtherTab";

export type TabDrawer = (layout: ObsidianLayout, page: Layout) => void;

interface TabDefinition {
    icon: string;
    key: string;
    draw: TabDrawer;
}

const TABS: TabDefinition[] = [
    { icon: "🏃", key: "movement", draw: MovementTab.draw },
    { icon: "👁", key: "esp", draw: ESPTab.draw },
    { icon: "🎭", key: "roles", draw: RolesTab.draw },
    { icon: "🚀", key: "ship", draw: ShipTab.draw },
    { icon: "✨", key: "passive", draw: PassiveTab.draw },
    { icon: "⚙", key: "other", draw: OtherTab.draw },
    { icon: "🛠", key: "debug", draw: DebugTab.draw }
];

const SELECTED_TAB_KEY = "selected_tab";

export class MenuUI {
    private static readonly tag = "MenuUI";

    static layout: ObsidianLayout;

    static init(): void {
        if (Java.available) {
            Java.perform(() => {
                waitForInit(MenuUI.build);
            });
            Logger.info(`[${this.tag}::init] Initialized`);
        }
    }

    private static build(): void {
        const layout = new ObsidianLayout(ObsidianConfig);
        MenuUI.layout = layout;

        const title = I18n.t("menu.info.title");
        const desc = I18n.t("menu.info.desc", Constants.VERSION, Il2Cpp.application.version!);

        const composer = new Composer(title, desc, layout);
        composer.icon(Constants.MOD_MENU_ICON_URL, "Web");

        const pages: Layout[] = [];
        const buttons: { setOpen: (open: boolean) => void }[] = [];

        // Accordion: one category open at a time, tapping the open one folds it again
        let openIndex = -1;
        const open = (index: number) => {
            openIndex = index;
            pages.forEach((page, i) => {
                Widgets.show(page, i === index);
                buttons[i].setOpen(i === index);
            });
            sharedPreferences.putInt(SELECTED_TAB_KEY, index);
        };

        TABS.forEach((tab, index) => {
            const page = Widgets.page();
            try {
                tab.draw(layout, page);
            } catch (error: any) {
                Logger.errorToast(error, `[${MenuUI.tag}::build] Failed to draw ${tab.key} tab`);
            }

            const button = Widgets.categoryButton(`${tab.icon}  ${I18n.t(`menu.tabs.${tab.key}`)}`, () => {
                open(openIndex === index ? -1 : index);
            });
            add(button.view);
            add(page);
            pages.push(page);
            buttons.push(button);
        });

        const savedTab = sharedPreferences.getInt(SELECTED_TAB_KEY);
        Java.scheduleOnMainThread(() => open(savedTab >= 0 && savedTab < TABS.length ? savedTab : -1));

        composer.show();
    }
}
