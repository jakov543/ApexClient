package com.apexclient.module;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/** A module that draws something on screen and can be dragged in the HUD editor. */
public abstract class HudModule extends Module {

    public static final int BG = 0x80000000;
    public static final int ACCENT = 0xFF7B5CFF;
    public static final int ACCENT2 = 0xFF22E3FF;

    public int x;
    public int y;

    protected HudModule(String name, String description, boolean enabledByDefault, int defaultX, int defaultY) {
        super(name, description, Category.HUD, enabledByDefault);
        this.x = defaultX;
        this.y = defaultY;
    }

    public abstract int getWidth(MinecraftClient mc);
    public abstract int getHeight(MinecraftClient mc);

    /** Draw at (x, y). {@code preview} = drawn in the HUD editor (use sample data if needed). */
    public abstract void draw(DrawContext ctx, MinecraftClient mc, int x, int y, boolean preview);

    /** Keeps the element on screen after a resize. */
    public void clamp(int screenW, int screenH, MinecraftClient mc) {
        x = Math.max(0, Math.min(x, screenW - getWidth(mc)));
        y = Math.max(0, Math.min(y, screenH - getHeight(mc)));
    }
}
