package com.apexclient.module;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/** Simple text box, Lunar style. Uses the Size / Background / Text colour options. */
public abstract class TextHudModule extends HudModule {

    protected TextHudModule(String name, String description, boolean enabledByDefault, int defaultX, int defaultY) {
        super(name, description, enabledByDefault, defaultX, defaultY);
    }

    protected abstract String getText(MinecraftClient mc, boolean preview);

    /** Override to colour the value (e.g. ping by latency). Return 0 to use the Text colour option. */
    protected int valueColor(MinecraftClient mc, boolean preview) { return 0; }

    @Override
    public int getWidth(MinecraftClient mc) {
        return Math.max(56, mc.textRenderer.getWidth(getText(mc, true)) + 12);
    }

    @Override
    public int getHeight(MinecraftClient mc) {
        return 16;
    }

    @Override
    public void draw(DrawContext ctx, MinecraftClient mc, int x, int y, boolean preview) {
        String text = getText(mc, preview);
        int w = Math.max(56, mc.textRenderer.getWidth(text) + 12);
        if (background.value) {
            ctx.fill(x, y, x + w, y + 16, BG);
            ctx.fill(x, y, x + 2, y + 16, ACCENT);
        }
        int c = valueColor(mc, preview);
        if (c == 0) c = textColor.color(x + y);
        ctx.drawCenteredTextWithShadow(mc.textRenderer, text, x + 1 + w / 2, y + 4, c);
    }
}
