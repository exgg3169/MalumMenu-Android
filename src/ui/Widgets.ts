import Java from "frida-java-bridge";

import {
    add,
    Api,
    app,
    CENTER,
    GONE,
    HORIZONTAL,
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

    /** Builds a horizontal, scrollable row of tab chips and returns its root view */
    static tabBar(labels: string[], onSelect: (index: number) => void): { root: Layout; select: (index: number) => void } {
        const scroll = new Layout(Java.use("android.widget.HorizontalScrollView"));
        scroll.instance.setHorizontalScrollBarEnabled(false);
        scroll.layoutParams = Layout.LinearLayoutParams(MATCH_PARENT, WRAP_CONTENT);
        scroll.padding = [this.dp(8), this.dp(2), this.dp(8), this.dp(6)];

        const row = new Layout(Api.LinearLayout);
        row.orientation = HORIZONTAL;
        add(row, scroll);

        const chips = labels.map((label, index) => {
            const chip = new TextView(label);
            chip.textSize = 13;
            chip.gravity = CENTER;
            chip.padding = [this.dp(14), this.dp(7), this.dp(14), this.dp(7)];
            chip.layoutParams = this.marginParams(WRAP_CONTENT, 3, 0);
            chip.onClickListener = () => select(index);
            add(chip, row);
            return chip;
        });

        const select = (index: number) => {
            chips.forEach((chip, i) => {
                const active = i === index;
                chip.background = this.rounded(active ? Theme.tabActive : Theme.tabInactive, 60);
                chip.textColor = active ? "#FFFFFF" : Theme.mutedText;
            });
            onSelect(index);
        };

        return { root: scroll, select };
    }

    static show(view: View, visible: boolean): void {
        view.visibility = visible ? VISIBLE : GONE;
    }
}
