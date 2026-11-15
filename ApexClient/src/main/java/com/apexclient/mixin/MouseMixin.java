package com.apexclient.mixin;

import com.apexclient.ApexClient;
import com.apexclient.module.ModuleManager;
import com.apexclient.module.impl.CpsModule;
import com.apexclient.module.impl.ZoomModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.Mouse;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Mouse.class)
public abstract class MouseMixin {

    /** Count clicks for CPS / Keystrokes. */
    @Inject(method = "onMouseButton", at = @At("HEAD"))
    private void apexclient$countClick(long window, int button, int action, int mods, CallbackInfo ci) {
        if (action == 1 && MinecraftClient.getInstance().currentScreen == null) CpsModule.click(button);
    }

    /** Scroll while zooming = zoom in/out instead of switching hotbar slot. */
    @Inject(method = "onMouseScroll", at = @At("HEAD"), cancellable = true)
    private void apexclient$zoomScroll(long window, double horizontal, double vertical, CallbackInfo ci) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.currentScreen == null && ApexClient.zoomKey != null && ApexClient.zoomKey.isPressed()
                && ModuleManager.get(ZoomModule.class).isEnabled()) {
            ZoomModule.zoomFov = Math.max(2.0, Math.min(50.0, ZoomModule.zoomFov - vertical * 2.0));
            ci.cancel();
        }
    }
}
