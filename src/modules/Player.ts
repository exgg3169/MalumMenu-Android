import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { UnityUtils } from "../utils/UnityUtils";
import { Logger } from "../logger/Logger";
import { ModuleManager } from "../core/ModuleManager";
import { VisualModule } from "./Visual";

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

    private ImpostorRole_FindClosestTarget: Il2Cpp.Method | null = null;
    private ImpostorRole_IsValidTarget: Il2Cpp.Method | null = null;
    private PlayerControl_SetKillTimer: Il2Cpp.Method | null = null;
    private PlayerControl_CmdCheckMurder: Il2Cpp.Method | null = null;
    private PlayerControl_RpcMurderPlayer: Il2Cpp.Method | null = null;

    private killEveryoneUntil = 0;
    private nextKillAt = 0;
    private reportedKillErrors = new Set<string>();

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

        // Impostor kill cheats patch the game's own kill logic, the same way MalumMenu for PC does
        const impostorRole = AssemblyHelper.AssemblyCSharp.tryClass("ImpostorRole");
        this.ImpostorRole_FindClosestTarget = impostorRole?.tryMethod("FindClosestTarget", 0) ?? null;
        this.ImpostorRole_IsValidTarget = impostorRole?.tryMethod("IsValidTarget", 1) ?? null;
        this.PlayerControl_SetKillTimer = this.PlayerControl.tryMethod("SetKillTimer", 1) ?? null;
        this.PlayerControl_CmdCheckMurder = this.PlayerControl.tryMethod("CmdCheckMurder", 1) ?? null;
        this.PlayerControl_RpcMurderPlayer = this.PlayerControl.tryMethod("RpcMurderPlayer", 2) ?? null;

        if (!this.ImpostorRole_FindClosestTarget) Logger.warn(`[${this.name}::init] ImpostorRole.FindClosestTarget not found, Kill Reach unavailable`);
        if (!this.ImpostorRole_IsValidTarget) Logger.warn(`[${this.name}::init] ImpostorRole.IsValidTarget not found, Kill Anyone unavailable`);
        if (!this.PlayerControl_SetKillTimer) Logger.warn(`[${this.name}::init] PlayerControl.SetKillTimer not found, No Kill Cooldown unavailable`);
        if (!this.PlayerControl_CmdCheckMurder) Logger.warn(`[${this.name}::init] PlayerControl.CmdCheckMurder not found, Kill Everyone unavailable`);
        if (!this.PlayerControl_RpcMurderPlayer) Logger.warn(`[${this.name}::init] PlayerControl.RpcMurderPlayer not found, host kills unavailable`);
    }

    public override initHooks(): void {
        const module = this;

        if (this.ImpostorRole_FindClosestTarget) {
            // @ts-ignore
            this.ImpostorRole_FindClosestTarget.implementation = function (): Il2Cpp.Object {
                if (State.killReach) {
                    try {
                        const target = module.nearestKillTarget(this as Il2Cpp.Object);
                        if (target) return target;
                    } catch (e) {
                        module.reportKillError("FindClosestTarget", e);
                    }
                }
                return this.method<Il2Cpp.Object>("FindClosestTarget").invoke();
            };
        }

        if (this.ImpostorRole_IsValidTarget) {
            // @ts-ignore
            this.ImpostorRole_IsValidTarget.implementation = function (target: Il2Cpp.Object): boolean {
                const valid = this.method<boolean>("IsValidTarget", 1).invoke(target);
                if (valid || !State.killAnyone || target.isNull()) return valid;

                try {
                    // Kill Anyone: also allow ghosts, impostors and players in vents, just not yourself
                    const localData = module.localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
                    return !target.field<boolean>("Disconnected").value && target.field<number>("PlayerId").value !== localData.field<number>("PlayerId").value;
                } catch (e) {
                    module.reportKillError("IsValidTarget", e);
                    return valid;
                }
            };
        }

        if (this.PlayerControl_SetKillTimer) {
            // @ts-ignore
            this.PlayerControl_SetKillTimer.implementation = function (time: number): void {
                const local = State.noKillCd && !module.localPlayer.isNull() && (this as Il2Cpp.Object).equals(module.localPlayer);
                return this.method<void>("SetKillTimer", 1).invoke(local ? 0 : time);
            };
        }

        if (this.PlayerControl_CmdCheckMurder) {
            // @ts-ignore
            this.PlayerControl_CmdCheckMurder.implementation = function (target: Il2Cpp.Object): void {
                try {
                    const wantsBypass = State.noKillCd || State.killAnyone || State.killReach;
                    if (wantsBypass && module.PlayerControl_RpcMurderPlayer && (this as Il2Cpp.Object).equals(module.localPlayer) && module.isHostLike()) {
                        // As host nobody else validates the kill, so send the result directly like MalumMenu does
                        this.method<void>("RpcMurderPlayer", 2).invoke(target, true);
                        return;
                    }
                } catch (e) {
                    module.reportKillError("CmdCheckMurder", e);
                }
                return this.method<void>("CmdCheckMurder", 1).invoke(target);
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
            module.applyNoKillCooldown();
            module.tickKillEveryone();
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

    private localRole(): Il2Cpp.Object | undefined {
        const localPlayer = this.localPlayer;
        if (localPlayer.isNull()) return undefined;

        const data = localPlayer.method<Il2Cpp.Object>("get_Data").invoke();
        if (data.isNull()) return undefined;

        const role = data.field<Il2Cpp.Object>("Role").value;
        return role.isNull() ? undefined : role;
    }

    private applyNoKillCooldown(): void {
        if (!State.noKillCd || !this.PlayerControl_SetKillTimer) return;

        try {
            const role = this.localRole();
            if (role && role.method<boolean>("get_IsImpostor").invoke()) {
                this.localPlayer.method<void>("SetKillTimer", 1).invoke(0);
            }
        } catch (e) {
            Logger.debug(`[${this.name}::applyNoKillCooldown] ${e}`);
        }
    }

    /** Valid kill targets for the given impostor role, closest first, at any distance */
    private killTargets(role: Il2Cpp.Object): Il2Cpp.Object[] {
        const localPlayer = this.localPlayer;
        const localPos = localPlayer.method<Il2Cpp.Object>("get_transform").invoke().method<Il2Cpp.Object>("get_position").invoke();
        const localX = localPos.field<number>("x").value;
        const localY = localPos.field<number>("y").value;

        const players = this.PlayerControl.field<Il2Cpp.Object>("AllPlayerControls").value;
        const count = players.method<number>("get_Count").invoke();
        const found: { player: Il2Cpp.Object; distance: number }[] = [];

        for (let i = 0; i < count; i++) {
            const player = players.method<Il2Cpp.Object>("get_Item").invoke(i);
            if (player.isNull() || player.equals(localPlayer)) continue;

            const data = player.method<Il2Cpp.Object>("get_Data").invoke();
            if (data.isNull() || !role.method<boolean>("IsValidTarget", 1).invoke(data)) continue;

            const pos = player.method<Il2Cpp.Object>("get_transform").invoke().method<Il2Cpp.Object>("get_position").invoke();
            const dx = pos.field<number>("x").value - localX;
            const dy = pos.field<number>("y").value - localY;
            found.push({ player, distance: dx * dx + dy * dy });
        }

        return found.sort((a, b) => a.distance - b.distance).map(entry => entry.player);
    }

    private nearestKillTarget(role: Il2Cpp.Object): Il2Cpp.Object | undefined {
        return this.killTargets(role)[0];
    }

    /** True when this client decides kills itself: lobby host or Free Play */
    private isHostLike(): boolean {
        const client = this.AmongUsClient.field<Il2Cpp.Object>("Instance").value;
        if (client.isNull()) return false;
        if (client.method<boolean>("get_AmHost").invoke()) return true;

        try {
            return Number(client.field<number>("NetworkMode").value) === Number(this.NetworkModes.field<number>("FreePlay").value);
        } catch (e) {
            return false;
        }
    }

    private reportKillError(feature: string, error: unknown): void {
        const key = `${feature}:${error}`;
        if (this.reportedKillErrors.has(key)) return;
        this.reportedKillErrors.add(key);
        Logger.error(`[${this.name}::${feature}] ${error}`);
    }

    /** Starts killing every valid target one after another, retrying for up to 30 seconds */
    public killEveryoneAsImpostor(): void {
        const role = this.localRole();
        if (!role || !role.method<boolean>("get_IsImpostor").invoke()) {
            throw new Error("You are not the impostor");
        }

        this.killEveryoneUntil = Date.now() + 30000;
        this.nextKillAt = 0;
    }

    private tickKillEveryone(): void {
        if (!this.killEveryoneUntil) return;

        const now = Date.now();
        if (now > this.killEveryoneUntil || now < this.nextKillAt) {
            if (now > this.killEveryoneUntil) this.killEveryoneUntil = 0;
            return;
        }

        try {
            const role = this.localRole();
            const target = role && role.method<boolean>("get_IsImpostor").invoke() ? this.nearestKillTarget(role) : undefined;
            if (!target) {
                this.killEveryoneUntil = 0;
                return;
            }

            // Without host rights the host still applies the kill cooldown, so a rejected kill is simply retried
            if (this.isHostLike() && this.PlayerControl_RpcMurderPlayer) {
                this.localPlayer.method<void>("RpcMurderPlayer", 2).invoke(target, true);
            } else {
                this.localPlayer.method<void>("CmdCheckMurder", 1).invoke(target);
            }
            this.nextKillAt = now + 800;
        } catch (e) {
            this.killEveryoneUntil = 0;
            this.reportKillError("killEveryone", e);
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

    /**
     * `static PlayerControl::LocalPlayer`
     *
     * @returns `PlayerControl` instance
     */
    private get localPlayer(): Il2Cpp.Object {
        return this.PlayerControl.field<Il2Cpp.Object>("LocalPlayer").value;
    }
}
