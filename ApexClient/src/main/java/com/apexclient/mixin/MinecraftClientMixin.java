package com.apexclient.mixin;

import com.apexclient.ApexClient;
import com.apexclient.ApexConfig;
import com.apexclient.gui.ApexMenuScreen;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import org.jetbrains.annotations.Nullable;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {

    @Shadow public abstract void setScreen(@Nullable Screen screen);

    /** Every time the game opens the vanilla title screen, open the Apex menu instead. */
    @Inject(method = "setScreen", at = @At("HEAD"), cancellable = true)
    private void apexclient$replaceTitleScreen(@Nullable Screen screen, CallbackInfo ci) {
        if (ApexConfig.customMainMenu && screen instanceof TitleScreen) {
            ci.cancel();
            setScreen(new ApexMenuScreen());
        }
    }

    /** Window title: "Apex Client 1.0.0 | 1.21.1" */
    @Inject(method = "getWindowTitle", at = @At("HEAD"), cancellable = true)
    private void apexclient$windowTitle(CallbackInfoReturnable<String> cir) {
        cir.setReturnValue(ApexClient.NAME + " " + ApexClient.VERSION + " | 1.21.1");
    }
}
