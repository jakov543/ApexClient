package com.apexclient.module.impl;

import com.apexclient.mixin.SimpleOptionAccessor;
import com.apexclient.module.Module;
import net.minecraft.client.MinecraftClient;

/** See in the dark. Pushes gamma past the vanilla 100% limit. */
public class FullbrightModule extends Module {

    private double previousGamma = 0.5;

    public FullbrightModule() { super("Fullbright", "See clearly in caves and at night", Category.VISUAL, false); }

    @Override
    protected void onEnable() { apply(); }

    @Override
    protected void onDisable() { restore(); }

    @SuppressWarnings("unchecked")
    public void apply() {
        MinecraftClient mc = MinecraftClient.getInstance();
        double now = mc.options.getGamma().getValue();
        if (now <= 1.0) previousGamma = now;
        ((SimpleOptionAccessor<Double>) (Object) mc.options.getGamma()).apexclient$setValue(16.0);
    }

    @SuppressWarnings("unchecked")
    public void restore() {
        MinecraftClient mc = MinecraftClient.getInstance();
        ((SimpleOptionAccessor<Double>) (Object) mc.options.getGamma()).apexclient$setValue(previousGamma);
    }
}
