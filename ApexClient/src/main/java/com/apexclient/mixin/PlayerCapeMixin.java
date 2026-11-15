package com.apexclient.mixin;

import com.apexclient.module.ModuleManager;
import com.apexclient.module.impl.CapeModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/** Gives your own player the Apex cape. */
@Mixin(AbstractClientPlayerEntity.class)
public abstract class PlayerCapeMixin {

    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void apexclient$cape(CallbackInfoReturnable<SkinTextures> cir) {
        if ((Object) this != MinecraftClient.getInstance().player) return;
        CapeModule cape = ModuleManager.get(CapeModule.class);
        if (!cape.isEnabled()) return;
        SkinTextures s = cir.getReturnValue();
        cir.setReturnValue(new SkinTextures(s.texture(), s.textureUrl(), CapeModule.CAPE,
                cape.elytra.value ? CapeModule.CAPE : s.elytraTexture(), s.model(), s.secure()));
    }
}
