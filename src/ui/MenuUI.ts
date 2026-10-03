import Java from "frida-java-bridge";

import { Api, ObsidianLayout, waitForInit, Composer, Layout, add, sharedPreferences } from "frida-java-menu";

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

        const pages = TABS.map(tab => {
            const page = Widgets.page();
            try {
                tab.draw(layout, page);
            } catch (error: any) {
                Logger.errorToast(error, `[${MenuUI.tag}::build] Failed to draw ${tab.key} tab`);
            }
            add(page);
            return page;
        });

        const tabBar = Widgets.tabBar(
            TABS.map(tab => `${tab.icon}  ${I18n.t(`menu.tabs.${tab.key}`)}`),
            index => {
                pages.forEach((page, i) => Widgets.show(page, i === index));
                layout.proxy.instance.scrollTo(0, 0);
                sharedPreferences.putInt(SELECTED_TAB_KEY, index);
            }
        );

        const savedTab = sharedPreferences.getInt(SELECTED_TAB_KEY);
        const initialTab = savedTab >= 0 && savedTab < TABS.length ? savedTab : 0;

        // Composer queues its own views on the main thread, so this runs after `me` is populated:
        // index 2 places the tab bar between the subtitle and the scrollable content
        Java.scheduleOnMainThread(() => {
            layout.me.instance.addView.overload("android.view.View", "int").call(layout.me.instance, Java.cast(tabBar.root.instance, Api.View), 2);
            tabBar.select(initialTab);
        });

        composer.show();
    }
}
