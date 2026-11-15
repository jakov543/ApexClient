package com.apexclient.module.impl;

import com.apexclient.mixin.SimpleOptionAccessor;
import com.apexclient.module.Module;
import net.minecraft.client.MinecraftClient;

/** See in the dark. Pushes gamma past the vanilla 100% limit. */
public class FullbrightModule extends Module {

    private double previousGamma = 0.5;

    public final com.apexclient.module.Setting.Slider level = add(new com.apexclient.module.Setting.Slider("Brightness", 2, 16, 1, 16, "x"));

    public FullbrightModule() {
        super("Fullbright", "See clearly in caves and at night", Category.VISUAL, false);
        level.onChange(() -> { if (isEnabled()) apply(); });
    }

    @Override
    protected void onEnable() { apply(); }

    @Override
    protected void onDisable() { restore(); }

    @SuppressWarnings("unchecked")
    public void apply() {
        MinecraftClient mc = MinecraftClient.getInstance();
        double now = mc.options.getGamma().getValue();
        if (now <= 1.0) previousGamma = now;
        ((SimpleOptionAccessor<Double>) (Object) mc.options.getGamma()).apexclient$setValue(level.value);
    }

    @SuppressWarnings("unchecked")
    public void restore() {
        MinecraftClient mc = MinecraftClient.getInstance();
        ((SimpleOptionAccessor<Double>) (Object) mc.options.getGamma()).apexclient$setValue(previousGamma);
    }
}
