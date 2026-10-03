import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { Logger } from "../logger/Logger";
import { State } from "../data/State";

export class PassiveModule extends BaseModule {
    public readonly name = "Passive";

    // Classes
    private Screen!: Il2Cpp.Class;
    private Application!: Il2Cpp.Class;

    private ResolutionManager!: Il2Cpp.Class;

    // Methods
    private ResolutionManager_SetResolution!: Il2Cpp.Method;

    private HasResolutionBeenChanged!: boolean;
    private OriginalWidth!: number;
    private OriginalHeight!: number;
    private OriginalFrameRate: number | undefined;

    public init(): void {
        this.Screen = AssemblyHelper.CoreModule.class("UnityEngine.Screen");
        this.Application = AssemblyHelper.CoreModule.class("UnityEngine.Application");

        this.ResolutionManager = AssemblyHelper.AssemblyCSharp.class("ResolutionManager");

        this.ResolutionManager_SetResolution = this.ResolutionManager.method<void>("SetResolution", 3);

        this.HasResolutionBeenChanged = false;
    }

    public toggleFullResolution(state: boolean): void {
        const module = this;

        if (!this.HasResolutionBeenChanged) {
            const original_resolution = module.Screen.method<Il2Cpp.Object>("get_currentResolution").invoke();
            module.OriginalWidth = original_resolution.method<number>("get_width").invoke();
            module.OriginalHeight = original_resolution.method<number>("get_height").invoke();
            Logger.debug(`[${module.name}::ToggleFullResolution] Original resolution: ${module.OriginalWidth}x${module.OriginalHeight}`);
        }
        this.HasResolutionBeenChanged = true;

        if (state) {
            // resolutions returns all full-screen resolutions that the monitor supports, sorted by width
            const resolutions = module.Screen.method<Il2Cpp.Array<Il2Cpp.Object>>("get_resolutions").invoke();
            const width = resolutions.get(0).method<number>("get_width").invoke();
            const height = resolutions.get(0).method<number>("get_height").invoke();
            //const refreshRateRatio = resolutions.get(0).method<Il2Cpp.Object>("get_refreshRateRatio").invoke();
            //const refreshRate = refreshRateRatio.field("value").value;

            Logger.debug(`[${module.name}::ToggleFullResolution] Setting resolution to ${height}x${width}`);
            module.ResolutionManager_SetResolution.invoke(height, width, true);
        } else {
            Logger.debug(`[${module.name}::ToggleFullResolution] Resetting resolution to ${module.OriginalWidth!}x${module.OriginalHeight!}`);
            module.ResolutionManager_SetResolution.invoke(module.OriginalWidth, module.OriginalHeight, true);
        }
    }

    public applyFrameRate(): void {
        if (this.OriginalFrameRate === undefined) {
            this.OriginalFrameRate = this.Application.method<number>("get_targetFrameRate").invoke();
            Logger.debug(`[${this.name}::applyFrameRate] Original target frame rate: ${this.OriginalFrameRate}`);
        }

        const target = State.fpsUnlock ? State.fps : this.OriginalFrameRate;
        this.Application.method<void>("set_targetFrameRate").invoke(target);
        Logger.debug(`[${this.name}::applyFrameRate] Target frame rate set to ${target}`);
    }
}
