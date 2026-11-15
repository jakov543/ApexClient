package com.apexclient.module;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/** Simple "Label: value" box, Lunar style. */
public abstract class TextHudModule extends HudModule {

    protected TextHudModule(String name, String description, boolean enabledByDefault, int defaultX, int defaultY) {
        super(name, description, enabledByDefault, defaultX, defaultY);
    }

    protected abstract String getText(MinecraftClient mc, boolean preview);

    @Override
    public int getWidth(MinecraftClient mc) {
        return Math.max(56, mc.textRenderer.getWidth(getText(mc, true)) + 10);
    }

    @Override
    public int getHeight(MinecraftClient mc) {
        return 16;
    }

    @Override
    public void draw(DrawContext ctx, MinecraftClient mc, int x, int y, boolean preview) {
        String text = getText(mc, preview);
        int w = getWidth(mc);
        ctx.fill(x, y, x + w, y + 16, BG);
        ctx.fill(x, y, x + 2, y + 16, ACCENT);
        ctx.drawCenteredTextWithShadow(mc.textRenderer, text, x + 1 + w / 2, y + 4, 0xFFFFFFFF);
    }
}
