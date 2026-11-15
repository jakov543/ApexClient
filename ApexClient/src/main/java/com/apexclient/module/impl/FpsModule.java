package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;

public class FpsModule extends TextHudModule {
    public FpsModule() { super("FPS", "Shows your frames per second", true, 4, 4); }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        return mc.getCurrentFps() + " FPS";
    }
}
