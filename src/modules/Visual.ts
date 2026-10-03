import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";
import { Logger } from "../logger/Logger";

const DEFAULT_CAMERA_SIZE = 3;
const NAME_REFRESH_INTERVAL = 15;
const CHAT_REFRESH_INTERVAL = 10;
const SPEED_REFRESH_INTERVAL = 30;

export class VisualModule extends BaseModule {
    public readonly name = "Visual";

    private Camera!: Il2Cpp.Class;
    private Color!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;

    private setTimeScale: ((scale: number) => void) | undefined;

    private zoomApplied = false;
    private speedApplied = false;
    private frame = 0;
    private recoloredPlayers = new Set<number>();
    private relabeledPlayers = new Set<number>();
    private reportedErrors = new Set<string>();

    public init(): void {
        this.Camera = AssemblyHelper.CoreModule.class("UnityEngine.Camera");
        this.Color = AssemblyHelper.CoreModule.class("UnityEngine.Color");
        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");

        const time = AssemblyHelper.CoreModule.class("UnityEngine.Time");
        const setter = time.tryMethod<void>("set_timeScale", 1);
        if (setter) {
            this.setTimeScale = (scale: number) => setter.invoke(scale);
        } else {
            Logger.error(`[${this.name}::init] UnityEngine.Time.set_timeScale not found, Speed Up Game is unavailable`);
        }
    }

    /** Runs once per `HudManager.Update`, after the game's own update logic */
    public onHudUpdate(hud: Il2Cpp.Object): void {
        this.frame++;

        this.safely("zoom", () => this.updateZoom());

        if (this.frame % CHAT_REFRESH_INTERVAL === 0) {
            this.safely("chat", () => this.updateChat(hud));
        }
        if (this.frame % SPEED_REFRESH_INTERVAL === 0) {
            this.safely("gameSpeed", () => this.updateGameSpeed());
        }
        if (this.frame % NAME_REFRESH_INTERVAL === 0) {
            this.safely("playerNames", () => this.updatePlayerNames());
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
        // SetVisible also brings back the chat button, which the game hides during rounds
        chat.method<void>("SetVisible", 1).invoke(true);
    }

    private updateGameSpeed(): void {
        if (!this.setTimeScale || (!State.gameSpeedEnabled && !this.speedApplied)) return;

        this.setTimeScale(State.gameSpeedEnabled ? State.gameSpeed : 1);
        this.speedApplied = State.gameSpeedEnabled;
    }

    private updatePlayerNames(): void {
        const active = State.revealImpostors || State.seeRoles;
        if (!active && this.recoloredPlayers.size === 0 && this.relabeledPlayers.size === 0) return;

        const localPlayer = this.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
        if (localPlayer.isNull()) return;
        const localIsImpostor = this.isImpostor(this.roleOf(localPlayer));

        const players = this.PlayerControl.field<Il2Cpp.Object>("AllPlayerControls").value;
        const count = players.method<number>("get_Count").invoke();

        for (let i = 0; i < count; i++) {
            const player = players.method<Il2Cpp.Object>("get_Item").invoke(i);
            if (player.isNull()) continue;

            const nameText = this.nameTextOf(player);
            if (!nameText) continue;

            const playerId = player.field<number>("PlayerId").value;
            const role = this.roleOf(player);
            const impostor = this.isImpostor(role);

            if (State.revealImpostors && impostor) {
                this.setColor(nameText, 1, 0.1, 0.1);
                this.recoloredPlayers.add(playerId);
            } else if (this.recoloredPlayers.has(playerId)) {
                // Impostors already see their teammates in red, so leave those alone
                if (!(localIsImpostor && impostor)) this.setColor(nameText, 1, 1, 1);
                this.recoloredPlayers.delete(playerId);
            }

            if (State.seeRoles && role) {
                const color = impostor ? "#FF4D4D" : "#7FE7FF";
                nameText
                    .method<void>("set_text")
                    .invoke(Il2Cpp.string(`<size=70%><color=${color}>${this.roleName(role)}</color></size>\n${this.playerName(player)}`));
                this.relabeledPlayers.add(playerId);
            } else if (this.relabeledPlayers.has(playerId)) {
                nameText.method<void>("set_text").invoke(Il2Cpp.string(this.playerName(player)));
                this.relabeledPlayers.delete(playerId);
            }
        }
    }

    private roleOf(player: Il2Cpp.Object): Il2Cpp.Object | undefined {
        const data = player.method<Il2Cpp.Object>("get_Data").invoke();
        if (data.isNull()) return undefined;

        const role = data.field<Il2Cpp.Object>("Role").value;
        return role.isNull() ? undefined : role;
    }

    private isImpostor(role: Il2Cpp.Object | undefined): boolean {
        return role ? role.method<boolean>("get_IsImpostor").invoke() : false;
    }

    private roleName(role: Il2Cpp.Object): string {
        try {
            const niceName = role.method<Il2Cpp.String>("get_NiceName").invoke().content;
            if (niceName) return niceName;
        } catch (e) {
            Logger.debug(`[${this.name}::roleName] get_NiceName failed, falling back to class name: ${e}`);
        }
        return role.class.name.replace(/Role$/, "");
    }

    private playerName(player: Il2Cpp.Object): string {
        const data = player.method<Il2Cpp.Object>("get_Data").invoke();
        return data.method<Il2Cpp.String>("get_PlayerName").invoke().content ?? "";
    }

    private nameTextOf(player: Il2Cpp.Object): Il2Cpp.Object | undefined {
        const cosmetics = player.field<Il2Cpp.Object>("cosmetics").value;
        if (cosmetics.isNull()) return undefined;

        const nameText = cosmetics.field<Il2Cpp.Object>("nameText").value;
        return nameText.isNull() ? undefined : nameText;
    }

    private setColor(text: Il2Cpp.Object, r: number, g: number, b: number): void {
        const color = UnityUtils.createInstance(this.Color, r, g, b, 1).unbox();
        text.method<void>("set_color").invoke(color);
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
