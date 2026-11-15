package com.apexclient.module;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/** A module that draws something on screen and can be dragged in the HUD editor. */
public abstract class HudModule extends Module {

    public static final int BG = 0x80000000;
    public static final int ACCENT = 0xFF7C5CFF;
    public static final int ACCENT2 = 0xFF2EE6FF;

    public int x;
    public int y;

    public final Setting.Slider scale = add(new Setting.Slider("Size", 0.5, 2.0, 0.05, 1.0, "x"));
    public final Setting.Bool background = add(new Setting.Bool("Background", true));
    public final Setting.Colour textColor = add(new Setting.Colour("Text colour", 0));

    protected HudModule(String name, String description, boolean enabledByDefault, int defaultX, int defaultY) {
        super(name, description, Category.HUD, enabledByDefault);
        this.x = defaultX;
        this.y = defaultY;
    }

    /** Size before scaling */
    public abstract int getWidth(MinecraftClient mc);
    public abstract int getHeight(MinecraftClient mc);

    public int scaledWidth(MinecraftClient mc) { return (int) Math.ceil(getWidth(mc) * scale.value); }
    public int scaledHeight(MinecraftClient mc) { return (int) Math.ceil(getHeight(mc) * scale.value); }

    /** Draw at (x, y) in unscaled coordinates. {@code preview} = drawn in an editor (use sample data if needed). */
    public abstract void draw(DrawContext ctx, MinecraftClient mc, int x, int y, boolean preview);

    /** Draws at this module's position with its size setting. */
    public void renderScaled(DrawContext ctx, MinecraftClient mc, boolean preview) {
        ctx.getMatrices().push();
        ctx.getMatrices().translate(x, y, 0);
        float s = (float) scale.value;
        ctx.getMatrices().scale(s, s, 1f);
        draw(ctx, mc, 0, 0, preview);
        ctx.getMatrices().pop();
    }

    /** Keeps the element on screen after a resize. */
    public void clamp(int screenW, int screenH, MinecraftClient mc) {
        x = Math.max(0, Math.min(x, screenW - scaledWidth(mc)));
        y = Math.max(0, Math.min(y, screenH - scaledHeight(mc)));
    }

    protected int bg() { return background.value ? BG : 0; }
}
