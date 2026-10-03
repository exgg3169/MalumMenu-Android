import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";
import { Logger } from "../logger/Logger";

const DEFAULT_CAMERA_SIZE = 3;
const NAME_REFRESH_INTERVAL = 15;

export class VisualModule extends BaseModule {
    public readonly name = "Visual";

    private Camera!: Il2Cpp.Class;
    private Color!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;

    private zoomApplied = false;
    private frame = 0;
    private recoloredPlayers = new Set<number>();
    private reportedErrors = new Set<string>();

    public init(): void {
        this.Camera = AssemblyHelper.CoreModule.class("UnityEngine.Camera");
        this.Color = AssemblyHelper.CoreModule.class("UnityEngine.Color");
        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
    }

    /** Runs once per `HudManager.Update`, after the game's own update logic */
    public onHudUpdate(hud: Il2Cpp.Object): void {
        this.safely("zoom", () => this.updateZoom());
        this.safely("chat", () => this.updateChat(hud));

        if (++this.frame % NAME_REFRESH_INTERVAL === 0) {
            this.safely("revealImpostors", () => this.updateImpostorNames());
        }
    }

    private updateZoom(): void {
        if (!State.zoomOut && !this.zoomApplied) return;

        const camera = this.Camera.method<Il2Cpp.Object>("get_main").invoke();
        if (camera.isNull()) return;

        const size = State.zoomOut ? DEFAULT_CAMERA_SIZE * State.zoom : DEFAULT_CAMERA_SIZE;
        camera.method<void>("set_orthographicSize").invoke(size);
        this.zoomApplied = State.zoomOut;
    }

    private updateChat(hud: Il2Cpp.Object): void {
        if (!State.alwaysShowChat) return;

        const chat = hud.field<Il2Cpp.Object>("Chat").value;
        if (chat.isNull()) return;

        UnityUtils.SetActive(UnityUtils.getGameObject(chat), true);
    }

    private updateImpostorNames(): void {
        if (!State.revealImpostors && this.recoloredPlayers.size === 0) return;

        const localPlayer = this.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
        if (localPlayer.isNull()) return;
        const localIsImpostor = this.isImpostor(localPlayer);

        const players = this.PlayerControl.field<Il2Cpp.Object>("AllPlayerControls").value;
        const count = players.method<number>("get_Count").invoke();

        for (let i = 0; i < count; i++) {
            const player = players.method<Il2Cpp.Object>("get_Item").invoke(i);
            if (player.isNull()) continue;

            const playerId = player.field<number>("PlayerId").value;
            const impostor = this.isImpostor(player);

            if (State.revealImpostors && impostor) {
                this.setNameColor(player, 1, 0.1, 0.1);
                this.recoloredPlayers.add(playerId);
            } else if (this.recoloredPlayers.has(playerId)) {
                // Impostors already see their teammates in red, so leave those alone
                if (!(localIsImpostor && impostor)) this.setNameColor(player, 1, 1, 1);
                this.recoloredPlayers.delete(playerId);
            }
        }
    }

    private isImpostor(player: Il2Cpp.Object): boolean {
        const data = player.method<Il2Cpp.Object>("get_Data").invoke();
        if (data.isNull()) return false;

        const role = data.field<Il2Cpp.Object>("Role").value;
        if (role.isNull()) return false;

        return role.method<boolean>("get_IsImpostor").invoke();
    }

    private setNameColor(player: Il2Cpp.Object, r: number, g: number, b: number): void {
        const cosmetics = player.field<Il2Cpp.Object>("cosmetics").value;
        if (cosmetics.isNull()) return;

        const nameText = cosmetics.field<Il2Cpp.Object>("nameText").value;
        if (nameText.isNull()) return;

        const color = UnityUtils.createInstance(this.Color, r, g, b, 1).unbox();
        nameText.method<void>("set_color").invoke(color);
    }

    /** Keeps one broken feature from breaking the whole HUD hook, and logs each distinct error once */
    private safely(feature: string, action: () => void): void {
        try {
            action();
        } catch (error: any) {
            const key = `${feature}:${error.message}`;
            if (this.reportedErrors.has(key)) return;
            this.reportedErrors.add(key);
            Logger.error(`[${this.name}::${feature}] ${error.stack}`);
        }
    }
}
