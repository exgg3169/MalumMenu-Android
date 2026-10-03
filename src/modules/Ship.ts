import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";
import { Logger } from "../logger/Logger";

// Values of the game's `SystemTypes` enum
const SystemTypes = {
    Reactor: 3,
    Electrical: 7,
    LifeSupp: 8,
    Comms: 14,
    Laboratory: 21
} as const;

export class ShipModule extends BaseModule {
    public readonly name = "Ship";

    private HudManager!: Il2Cpp.Class;
    private MapOptions!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;
    private ShipStatus!: Il2Cpp.Class;
    private VentilationSystem!: Il2Cpp.Class;

    private ShipStatus_FixedUpdate!: Il2Cpp.Method;
    private PlayerControl_RpcMurderPlayer: Il2Cpp.Method<void> | null = null;

    public init(): void {
        this.HudManager = AssemblyHelper.AssemblyCSharp.class("HudManager");
        this.MapOptions = AssemblyHelper.AssemblyCSharp.class("MapOptions");
        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
        this.ShipStatus = AssemblyHelper.AssemblyCSharp.class("ShipStatus");
        this.VentilationSystem = AssemblyHelper.AssemblyCSharp.class("VentilationSystem");

        this.ShipStatus_FixedUpdate = this.ShipStatus.method<void>("FixedUpdate");

        const murderMethod = this.PlayerControl.tryMethod<void>("RpcMurderPlayer", 2);
        this.PlayerControl_RpcMurderPlayer = murderMethod || null;
        if (!this.PlayerControl_RpcMurderPlayer) {
            Logger.warn(`[${this.name}::init] PlayerControl.RpcMurderPlayer not found, Kill unavailable`);
        }
    }

    public override initHooks(): void {
        const module = this;

        this.ShipStatus_FixedUpdate.implementation = function (): void {
            if (State.walkInVents) {
                const localPlayer = module.localPlayer;

                if (localPlayer.isNull()) {
                    return this.method<void>("FixedUpdate").invoke();
                }

                localPlayer.field<boolean>("inVent").value = false;
                localPlayer.field<boolean>("moveable").value = true;
            }

            return this.method<void>("FixedUpdate").invoke();
        };
    }

    public callMeeting(): void {
        const module = this;

        const ShipStatusInstance = module.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            Logger.warn(`[${module.name}::callMeeting] ShipStatusInstance is null`);
            return;
        }

        const localPlayer = module.localPlayer;
        if (localPlayer.isNull()) {
            Logger.warn(`[${module.name}::callMeeting] LocalPlayer is null`);
            return;
        }

        localPlayer.method<void>("CmdReportDeadBody").invoke(NULL);
    }

    public sabotageReactor(): void {
        this.updateSystem("sabotageReactor", SystemTypes.Reactor, 128);
    }

    public sabotageOxygen(): void {
        this.updateSystem("sabotageOxygen", SystemTypes.LifeSupp, 128);
    }

    public sabotageComms(): void {
        this.updateSystem("sabotageComms", SystemTypes.Comms, 128);
    }

    public sabotageLights(): void {
        // 128 = flip the switches in the mask (low 5 bits) instead of a single switch
        this.updateSystem("sabotageLights", SystemTypes.Electrical, 128 | 0b11111);
    }

    public repairSabotages(): void {
        for (const system of [SystemTypes.Reactor, SystemTypes.Laboratory, SystemTypes.LifeSupp, SystemTypes.Comms]) {
            this.updateSystem("repairSabotages", system, 16);
        }
    }

    /** Sends `ShipStatus.RpcUpdateSystem`, skipping systems the current map doesn't have */
    private updateSystem(caller: string, system: number, amount: number): void {
        const ShipStatusInstance = this.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            Logger.warn(`[${this.name}::${caller}] ShipStatusInstance is null`);
            return;
        }

        const systems = ShipStatusInstance.field<Il2Cpp.Object>("Systems").value;
        if (!systems.method<boolean>("ContainsKey").invoke(system)) {
            Logger.debug(`[${this.name}::${caller}] System ${system} does not exist on this map`);
            return;
        }

        ShipStatusInstance.method<void>("RpcUpdateSystem").invoke(system, amount);
    }

    public kickVents(): void {
        const module = this;

        const ShipStatusInstance = module.ShipStatus.field<Il2Cpp.Object>("Instance").value;
        if (ShipStatusInstance.isNull()) {
            Logger.warn(`[${module.name}::kickVents] ShipStatusInstance is null`);
            return;
        }

        const allVents = ShipStatusInstance.method<Il2Cpp.Array<Il2Cpp.Object>>("get_AllVents").invoke();

        for (const vent of allVents) {
            // VentilationSystem.Operation.BootImpostors = 5
            module.VentilationSystem.method<void>("Update", 2).invoke(5, vent.field("Id").value);
        }
    }

    public openSabotageMap(): void {
        const module = this;

        const HudManagerInstanceExists = module.HudManager.method<boolean>("get_InstanceExists").invoke();
        if (!HudManagerInstanceExists) {
            Logger.warn(`[${module.name}::openSabotageMap] HudManagerInstance does not exist`);
            return;
        }

        // No isNull check here because we trust that InstanceExists tells the truth
        const HudManagerInstance = module.HudManager.method<Il2Cpp.Object>("get_Instance").invoke();
        const MapOptions = UnityUtils.createInstance(module.MapOptions);
        const Modes = module.MapOptions.nested("Modes");
        const Sabotage = Modes.field("Sabotage");

        MapOptions.field("Mode").value = Sabotage.value;

        HudManagerInstance.method<void>("ToggleMapVisible", 1).invoke(MapOptions);
    }

    public killPlayer(target: Il2Cpp.Object): void {
        const module = this;

        if (!module.PlayerControl_RpcMurderPlayer) {
            Logger.warn(`[${module.name}::killPlayer] RpcMurderPlayer not available`);
            return;
        }

        const localPlayer = module.localPlayer;
        if (localPlayer.isNull()) {
            Logger.warn(`[${module.name}::killPlayer] LocalPlayer is null`);
            return;
        }

        try {
            const targetData = target.method<Il2Cpp.Object>("get_Data").invoke();
            if (targetData.isNull()) {
                Logger.warn(`[${module.name}::killPlayer] Target data is null`);
                return;
            }
            localPlayer.method<void>("RpcMurderPlayer").invoke(target);
            Logger.debug(`[${module.name}::killPlayer] Killed player`);
        } catch (e) {
            Logger.error(`[${module.name}::killPlayer] ${e}`);
        }
    }

    public killAllImpostors(): void {
        const module = this;

        const localPlayer = module.localPlayer;
        if (localPlayer.isNull()) {
            Logger.warn(`[${module.name}::killAllImpostors] LocalPlayer is null`);
            return;
        }

        const players = this.PlayerControl.field<Il2Cpp.Object>("AllPlayerControls").value;
        const count = players.method<number>("get_Count").invoke();

        for (let i = 0; i < count; i++) {
            const player = players.method<Il2Cpp.Object>("get_Item").invoke(i);
            if (player.isNull()) continue;

            const data = player.method<Il2Cpp.Object>("get_Data").invoke();
            if (data.isNull()) continue;

            const role = data.field<Il2Cpp.Object>("Role").value;
            if (role.isNull()) continue;

            const isImpostor = role.method<boolean>("get_IsImpostor").invoke();
            if (isImpostor && !player.equals(localPlayer)) {
                module.killPlayer(player);
            }
        }

        Logger.debug(`[${module.name}::killAllImpostors] Killed all impostors`);
    }

    /**
     * `static PlayerControl::LocalPlayer`
     *
     * @returns `PlayerControl` instance
     */
    private get localPlayer(): Il2Cpp.Object {
        return this.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
    }
}
