package com.apexclient.module.impl;

import com.apexclient.module.Module;
import net.minecraft.client.MinecraftClient;

/** Always sprint when walking forward. */
public class ToggleSprintModule extends Module {
    public final com.apexclient.module.Setting.Bool inWater = add(new com.apexclient.module.Setting.Bool("Also when swimming", true));

    public ToggleSprintModule() { super("Toggle Sprint", "Sprint automatically when walking forward", Category.PVP, false); }

    @Override
    public void onTick(MinecraftClient mc) {
        if (mc.player == null) return;
        if (!inWater.value && mc.player.isTouchingWater()) return;
        if (mc.options.forwardKey.isPressed() && !mc.player.isSneaking() && !mc.player.horizontalCollision
                && !mc.player.isUsingItem() && mc.player.getHungerManager().getFoodLevel() > 6) {
            mc.player.setSprinting(true);
        }
    }
}
