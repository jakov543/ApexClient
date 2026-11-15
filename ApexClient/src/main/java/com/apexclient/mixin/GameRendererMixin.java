package com.apexclient.mixin;

import com.apexclient.ApexClient;
import com.apexclient.module.ModuleManager;
import com.apexclient.module.impl.ZoomModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.render.Camera;
import net.minecraft.client.render.GameRenderer;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Hold C to zoom (smooth). */
@Mixin(GameRenderer.class)
public abstract class GameRendererMixin {

    @org.spongepowered.asm.mixin.Unique
    private double apexclient$zoomProgress = 0;

    @Inject(method = "getFov", at = @At("RETURN"), cancellable = true)
    private void apexclient$zoom(Camera camera, float tickDelta, boolean changingFov, CallbackInfoReturnable<Double> cir) {
        if (!changingFov) return; // hand rendering uses the un-zoomed fov
        boolean zooming = ApexClient.zoomKey != null && ApexClient.zoomKey.isPressed()
                && MinecraftClient.getInstance().currentScreen == null
                && ModuleManager.get(ZoomModule.class).isEnabled();
        apexclient$zoomProgress += ((zooming ? 1 : 0) - apexclient$zoomProgress) * 0.25;
        if (apexclient$zoomProgress < 0.001) return;
        double fov = cir.getReturnValue();
        cir.setReturnValue(fov + (Math.min(fov, ZoomModule.zoomFov) - fov) * apexclient$zoomProgress);
    }
}
