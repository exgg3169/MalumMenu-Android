import Java from "frida-java-bridge";

import {
    add,
    Api,
    app,
    CENTER,
    GONE,
    Layout,
    MATCH_PARENT,
    ObsidianLayout,
    parseColor,
    sharedPreferences,
    TextView,
    VERTICAL,
    View,
    VISIBLE,
    WRAP_CONTENT
} from "frida-java-menu";

import { Theme } from "../data/LayoutConfig";
import { Logger } from "../logger/Logger";
import { UnityUtils } from "../utils/UnityUtils";

export class Widgets {
    static dp(value: number): number {
        return Math.round(value * app.context.getResources().getDisplayMetrics().density.value);
    }

    static rounded(color: string, radius: number = Theme.cornerRadius): Java.Wrapper {
        const drawable = Api.GradientDrawable.$new();
        drawable.setCornerRadius(radius);
        drawable.setColor(parseColor(color));
        return drawable;
    }

    static marginParams(width: number, horizontal: number, vertical: number): Java.Wrapper {
        const params = Layout.LinearLayoutParams(width, WRAP_CONTENT);
        params.setMargins(this.dp(horizontal), this.dp(vertical), this.dp(horizontal), this.dp(vertical));
        return params;
    }

    /** Gives a widget the rounded card look used across all tabs */
    static card<T extends View>(view: T, color: string = Theme.card): T {
        view.background = this.rounded(color);
        view.layoutParams = this.marginParams(MATCH_PARENT, 6, 3);
        return view;
    }

    /** Reads an int setting, storing `fallback` first if it was never saved */
    static savedInt(key: string, fallback: number): number {
        if (!sharedPreferences.contains(key)) sharedPreferences.putInt(key, fallback);
        return sharedPreferences.getInt(key);
    }

    /** Seekbar whose value survives restarts (the stock one only restores the thumb, not the callback state) */
    static seekbar(layout: ObsidianLayout, label: string, max: number, min: number, onChange: (value: number) => void): View {
        return this.card(
            layout.seekbar(label, max, min, (value: number) => {
                sharedPreferences.putInt(label, value);
                onChange(value);
            })
        );
    }

    static page(): Layout {
        const page = new Layout(Api.LinearLayout);
        page.orientation = VERTICAL;
        page.layoutParams = Layout.LinearLayoutParams(MATCH_PARENT, WRAP_CONTENT);
        page.padding = [0, this.dp(4), 0, this.dp(8)];
        page.visibility = GONE;
        return page;
    }

    static header(text: string): TextView {
        const header = new TextView(`<b>${text.toUpperCase()}</b>`);
        header.textColor = Theme.accent;
        header.textSize = 11;
        header.padding = [this.dp(12), this.dp(10), this.dp(12), this.dp(2)];
        return header;
    }

    static note(text: string): TextView {
        const note = new TextView(text);
        note.textColor = Theme.mutedText;
        note.textSize = 11;
        note.padding = [this.dp(12), 0, this.dp(12), this.dp(4)];
        return note;
    }

    static infoRow(label: string, value: string): TextView {
        const row = new TextView(`<font color="${Theme.mutedText}">${label}</font>  ${value}`);
        row.textColor = Theme.text;
        row.textSize = 12;
        row.padding = [this.dp(12), this.dp(2), this.dp(12), this.dp(2)];
        return row;
    }

    /** Full-width category button in the style of "▽ Player Menu ▽"; `setOpen` flips the arrows and colors */
    static categoryButton(label: string, onClick: () => void): { view: TextView; setOpen: (open: boolean) => void } {
        const view = new TextView(label);
        view.textSize = 14;
        view.gravity = CENTER;
        view.padding = [this.dp(12), this.dp(11), this.dp(12), this.dp(11)];
        view.layoutParams = this.marginParams(MATCH_PARENT, 6, 3);
        view.onClickListener = onClick;

        const setOpen = (open: boolean) => {
            const arrow = open ? "△" : "▽";
            view.text = `<b>${arrow}  ${label}  ${arrow}</b>`;
            view.background = this.rounded(open ? Theme.tabActive : Theme.tabInactive, 18);
            view.textColor = open ? "#FFFFFF" : Theme.text;
        };
        setOpen(false);

        return { view, setOpen };
    }

    /** Runs a button action on the Unity thread and shows a toast if it fails instead of failing silently */
    static action(name: string, fn: () => void): () => void {
        return UnityUtils.run(() => {
            try {
                fn();
            } catch (error: any) {
                Logger.errorToast(error, `${name}:`);
            }
        });
    }

    static show(view: View, visible: boolean): void {
        view.visibility = visible ? VISIBLE : GONE;
    }
}
