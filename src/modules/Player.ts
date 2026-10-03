import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";
import { Logger } from "../logger/Logger";
import { ModuleManager } from "../core/ModuleManager";
import { VisualModule } from "./Visual";
import { ShipModule } from "./Ship";

export class PlayerModule extends BaseModule {
    public readonly name = "Player";

    private Vector2!: Il2Cpp.Class;

    private AmongUsClient!: Il2Cpp.Class;
    private Constants!: Il2Cpp.Class;
    private NetworkModes!: Il2Cpp.Class;
    private PhysicsHelpers!: Il2Cpp.Class;
    private PlayerControl!: Il2Cpp.Class;
    private PlayerPhysics!: Il2Cpp.Class;
    private PlayerPurchasesData!: Il2Cpp.Class;
    private HudManager!: Il2Cpp.Class;
    private Vent!: Il2Cpp.Class;

    private Vector2_Distance!: Il2Cpp.Method;

    private PhysicsHelpers_AnythingBetween!: Il2Cpp.Method;
    private PlayerPhysics_LateUpdate!: Il2Cpp.Method;
    private PlayerPurchasesData_GetPurchase!: Il2Cpp.Method;
    private HudManager_Update!: Il2Cpp.Method;
    private Vent_CanUse!: Il2Cpp.Method;

    private PlayerControl_RpcRemovePlayer: Il2Cpp.Method<void> | null = null;
    private GameManager_RpcSetHost: Il2Cpp.Method<void> | null = null;

    public init(): void {
        this.Vector2 = AssemblyHelper.CoreModule.class("UnityEngine.Vector2");

        this.AmongUsClient = AssemblyHelper.AssemblyCSharp.class("AmongUsClient");
        this.Constants = AssemblyHelper.AssemblyCSharp.class("Constants");
        this.NetworkModes = AssemblyHelper.AssemblyCSharp.class("NetworkModes");
        this.PhysicsHelpers = AssemblyHelper.AssemblyCSharp.class("PhysicsHelpers");
        this.PlayerControl = AssemblyHelper.AssemblyCSharp.class("PlayerControl");
        this.PlayerPhysics = AssemblyHelper.AssemblyCSharp.class("PlayerPhysics");
        this.PlayerPurchasesData = AssemblyHelper.AssemblyCSharp.class("PlayerPurchasesData");
        this.HudManager = AssemblyHelper.AssemblyCSharp.class("HudManager");
        this.Vent = AssemblyHelper.AssemblyCSharp.class("Vent");

        this.Vector2_Distance = this.Vector2.method<number>("Distance", 2);

        this.PhysicsHelpers_AnythingBetween = this.PhysicsHelpers.method<boolean>("AnythingBetween", 5);
        this.PlayerPhysics_LateUpdate = this.PlayerPhysics.method<void>("LateUpdate");
        this.PlayerPurchasesData_GetPurchase = this.PlayerPurchasesData.method<boolean>("GetPurchase");
        this.HudManager_Update = this.HudManager.method<void>("Update");
        this.Vent_CanUse = this.Vent.method<boolean>("CanUse", 3);

        const removePlayerMethod = this.PlayerControl.tryMethod<void>("RpcRemovePlayer", 1);
        this.PlayerControl_RpcRemovePlayer = removePlayerMethod || null;
        if (!this.PlayerControl_RpcRemovePlayer) {
            Logger.warn(`[${this.name}::init] PlayerControl.RpcRemovePlayer not found, Unkickable unavailable`);
        }

        const GameManager = AssemblyHelper.AssemblyCSharp.tryClass("GameManager");
        if (GameManager) {
            const hostMethod = GameManager.tryMethod<void>("RpcSetHost", 1);
            this.GameManager_RpcSetHost = hostMethod || null;
            if (!this.GameManager_RpcSetHost) {
                Logger.warn(`[${this.name}::init] GameManager.RpcSetHost not found, Capture Host unavailable`);
            }
        } else {
            Logger.warn(`[${this.name}::init] GameManager class not found`);
        }
    }

    public override initHooks(): void {
        const module = this;

        if (module.PlayerControl_RpcRemovePlayer) {
            // @ts-ignore - implementation signature mismatch
            module.PlayerControl_RpcRemovePlayer.implementation = function (playerId: number): void {
                const localPlayer = module.localPlayer;
                const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
                const currentPlayerId = data.field<number>("PlayerId").value;

                if (State.unkickable && playerId === currentPlayerId) {
                    Logger.debug(`[${module.name}::RpcRemovePlayer] Blocked removal of local player (unkickable)`);
                    return;
                }

                return this.method<void>("RpcRemovePlayer", 1).invoke(playerId);
            };
        }

        if (module.GameManager_RpcSetHost) {
            // @ts-ignore - implementation signature mismatch
            module.GameManager_RpcSetHost.implementation = function (newHostId: number): void {
                if (State.captureHost) {
                    const localPlayer = module.localPlayer;
                    const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
                    const myId = data.field<number>("PlayerId").value;
                    Logger.debug(`[${module.name}::RpcSetHost] Capture Host active, setting host to local player ${myId}`);
                    return this.method<void>("RpcSetHost", 1).invoke(myId);
                }

                return this.method<void>("RpcSetHost", 1).invoke(newHostId);
            };
        }

        this.PlayerPhysics_LateUpdate.implementation = function (): void {
            //const myPlayer = module.PlayerPhysics.field<Il2Cpp.Object>("myPlayer");
            const localPlayer = module.localPlayer;

            // If we leave and re-join a game, localPlayer.handle points to dead memory
            // To prevent this, we check the internal Unity m_CachedPtr for 0x0
            // Since it's always pointing to real memory
            let cachedPtr: Il2Cpp.Pointer;
            try {
                cachedPtr = UnityUtils.cachedPtr(localPlayer);
            } catch (e) {
                Logger.debug(e + " (This error is expected due to m_CachedPtr not being set yet)");
                return this.method<void>("LateUpdate").invoke();
            }

            if (localPlayer.isNull() || cachedPtr.isNull()) {
                return this.method<void>("LateUpdate").invoke();
            }

            // instance field: public Collider2D Collider;
            const collider = localPlayer.field<Il2Cpp.Object>("Collider").value;

            if (State.noclip) {
                collider.method("set_enabled").invoke(false);
            } else {
                collider.method("set_enabled").invoke(true);
            }

            const myPhysics = localPlayer.field<Il2Cpp.Object>("MyPhysics").value;

            if (State.customSpeed) {
                myPhysics.field<number>("Speed").value = State.speed;
                myPhysics.field<number>("GhostSpeed").value = State.speed;
            } else {
                myPhysics.field<number>("Speed").value = 2.5;
                myPhysics.field<number>("GhostSpeed").value = 3;
            }

            return this.method<void>("LateUpdate").invoke();
        };

        // @ts-ignore
        this.PlayerPurchasesData_GetPurchase.implementation = function (itemKey: Il2Cpp.String, bundleKey: Il2Cpp.String): boolean {
            if (State.unlockCosmetics) {
                return true;
            }
            return this.method<boolean>("GetPurchase", 2).invoke(itemKey, bundleKey);
        };

        this.HudManager_Update.implementation = function (): void {
            module.applyHudTweaks();
            this.method<void>("Update").invoke();
            ModuleManager.get(VisualModule)?.onHudUpdate(this as Il2Cpp.Object);

            if (State.canKill) {
                module.tryKillNearest();
            }
        };

        //@ts-ignore
        this.Vent_CanUse.implementation = function (pc: Il2Cpp.Object, canUse: Il2Cpp.Reference<boolean>, couldUse: Il2Cpp.Reference<boolean>): number {
            if (!State.unlockVents) {
                return this.method<number>("CanUse", 3).invoke(pc, canUse, couldUse);
            }

            const localPlayer = module.localPlayer;
            const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();

            if (localPlayer.isNull() || data.isNull()) {
                return this.method<number>("CanUse", 3).invoke(pc, canUse, couldUse);
            }

            const role = data.field<Il2Cpp.Object>("Role").value;
            const canVent = role.field<boolean>("CanVent").value;
            const isDead = data.field<boolean>("IsDead").value;

            if (canVent || isDead) {
                return this.method<number>("CanUse", 3).invoke(pc, canUse, couldUse);
            }

            const object = pc.method<Il2Cpp.Object>("get_Object").invoke();
            const collider = object.field<Il2Cpp.Object>("Collider").value;
            const bounds = collider.method<Il2Cpp.Object>("get_bounds").invoke();
            const center = bounds.method<Il2Cpp.Object>("get_center").invoke();

            const transform = this.method<Il2Cpp.Object>("get_transform").invoke();
            const position = transform.method<Il2Cpp.Object>("get_position").invoke();

            // Convert from Vector3 to Vector2. Works, but there's probably a better way of doing it.
            const centerX = center.field<number>("x").value;
            const centerY = center.field<number>("y").value;
            const positionX = position.field<number>("x").value;
            const positionY = position.field<number>("y").value;

            const centerVector2 = UnityUtils.createVector2(centerX, centerY);
            const positionVector2 = UnityUtils.createVector2(positionX, positionY);

            const num = module.Vector2_Distance.invoke(centerVector2, positionVector2) as number;

            const usableDistance = this.method<number>("get_UsableDistance").invoke(); // 0.75f
            const shipOnlyMask = module.Constants.field<number>("ShipOnlyMask").value;

            // Allow usage of vents unless the vent is too far or there are objects blocking the player's path
            canUse.value =
                num <= usableDistance && !module.PhysicsHelpers_AnythingBetween.invoke(collider, centerVector2, positionVector2, shipOnlyMask, false);
            couldUse.value = true;
            return num;
        };
    }

    private applyHudTweaks(): void {
        const HudManagerInstance = this.HudManager.method<Il2Cpp.Object>("get_Instance").invoke();
        const localPlayer = this.localPlayer;

        if (HudManagerInstance.isNull() || localPlayer.isNull()) return;

        // NetworkedPlayerInfo
        const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
        const impostorVentButton = HudManagerInstance.field<Il2Cpp.Object>("ImpostorVentButton").value;
        const impostorVentButtonGameObject = UnityUtils.getGameObject(impostorVentButton);

        const shadowQuad = HudManagerInstance.field<Il2Cpp.Object>("ShadowQuad").value;
        const shadowQuadGameObject = UnityUtils.getGameObject(shadowQuad);

        // The shadow mask is sized for the default camera, so it breaks when zoomed out
        shadowQuadGameObject.method<void>("SetActive", 1).invoke(!(State.noShadows || State.zoomOut));

        let role: Il2Cpp.Object;
        let canVent: boolean;
        try {
            // RoleBehaviour
            role = data.field<Il2Cpp.Object>("Role").value;
            canVent = role.field<boolean>("CanVent").value;
        } catch (e) {
            Logger.debug(e + " (This error is expected due to Role field not being set yet)");
            return;
        }
        const isDead = data.field<boolean>("IsDead").value;

        if (isDead) {
            shadowQuadGameObject.method<void>("SetActive", 1).invoke(false);
        }

        if (!canVent && !isDead) {
            impostorVentButtonGameObject.method<void>("SetActive", 1).invoke(State.unlockVents);
        }
    }

    public completeTask(task: Il2Cpp.Object): void {
        const module = this;
        const localPlayer = module.localPlayer;

        const taskId = task.method<number>("get_Id").invoke();
        // const isComplete = task.method<boolean>("get_IsComplete").invoke();
        localPlayer.method("RpcCompleteTask").invoke(taskId);
    }

    public completeMyTasks(): void {
        const module = this;

        const localPlayer = module.localPlayer;
        if (localPlayer.isNull()) {
            Logger.warn(`[${module.name}::completeMyTasks] LocalPlayer is null`);
            return;
        }

        // System.Collections.Generic.List<PlayerTask> myTasks;
        const myTasks = localPlayer.field<Il2Cpp.Object>("myTasks").value;

        // Iterate over the list. Source: https://github.com/vfsfitvnm/frida-il2cpp-bridge/issues/556
        const taskCount = myTasks.method<number>("get_Count").invoke();
        Logger.debug(`[${module.name}::completeMyTasks] Found ${taskCount} tasks`);
        for (let i = 0; i < taskCount; i++) {
            const task = myTasks.method<Il2Cpp.Object>("get_Item").invoke(i);
            module.completeTask(task);
        }
    }

    private tryKillNearest(): void {
        const module = this;
        const ship = ModuleManager.get(ShipModule);
        if (!ship) return;

        const localPlayer = module.localPlayer;
        if (localPlayer.isNull()) return;

        const localPos = localPlayer.field<Il2Cpp.Object>("transform").value.method<Il2Cpp.Object>("get_position").invoke();
        const localX = localPos.field<number>("x").value;
        const localY = localPos.field<number>("y").value;

        const players = this.PlayerControl.field<Il2Cpp.Object>("AllPlayerControls").value;
        const count = players.method<number>("get_Count").invoke();

        let nearest: Il2Cpp.Object | null = null;
        let minDistance = Number.MAX_VALUE;

        for (let i = 0; i < count; i++) {
            const player = players.method<Il2Cpp.Object>("get_Item").invoke(i);
            if (player.isNull() || player.equals(localPlayer)) continue;

            try {
                const pos = player.field<Il2Cpp.Object>("transform").value.method<Il2Cpp.Object>("get_position").invoke();
                const x = pos.field<number>("x").value;
                const y = pos.field<number>("y").value;

                const distance = Math.sqrt((x - localX) * (x - localX) + (y - localY) * (y - localY));
                if (distance < minDistance && distance < 2.5) {
                    minDistance = distance;
                    nearest = player;
                }
            } catch (e) {
                Logger.debug(`[${this.name}::tryKillNearest] ${e}`);
            }
        }

        if (nearest) {
            ship.killPlayer(nearest);
        }
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
