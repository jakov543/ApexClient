package com.apexclient.module.impl;

import com.apexclient.module.HudModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.option.KeyBinding;

/** W A S D + LMB/RMB with CPS + space bar, lights up when pressed. */
public class KeystrokesModule extends HudModule {

    private static final int KEY = 22, GAP = 2;

    public KeystrokesModule() { super("Keystrokes", "Shows WASD, mouse buttons and CPS", true, 4, 120); }

    @Override
    public int getWidth(MinecraftClient mc) { return KEY * 3 + GAP * 2; }

    @Override
    public int getHeight(MinecraftClient mc) { return KEY * 3 + GAP * 3 + 12; }

    @Override
    public void draw(DrawContext ctx, MinecraftClient mc, int x, int y, boolean preview) {
        var o = mc.options;
        int full = getWidth(mc);
        key(ctx, mc, "W", o.forwardKey, x + KEY + GAP, y, KEY, KEY);
        key(ctx, mc, "A", o.leftKey, x, y + KEY + GAP, KEY, KEY);
        key(ctx, mc, "S", o.backKey, x + KEY + GAP, y + KEY + GAP, KEY, KEY);
        key(ctx, mc, "D", o.rightKey, x + (KEY + GAP) * 2, y + KEY + GAP, KEY, KEY);

        int half = (full - GAP) / 2;
        int my = y + (KEY + GAP) * 2;
        box(ctx, mc, "LMB", CpsModule.left() + " CPS", o.attackKey.isPressed(), x, my, half, KEY);
        box(ctx, mc, "RMB", CpsModule.right() + " CPS", o.useKey.isPressed(), x + half + GAP, my, full - half - GAP, KEY);

        int sy = my + KEY + GAP;
        boolean space = o.jumpKey.isPressed();
        ctx.fill(x, sy, x + full, sy + 12, space ? 0xD0FFFFFF : BG);
        ctx.fill(x + full / 2 - 12, sy + 5, x + full / 2 + 12, sy + 7, space ? 0xFF000000 : 0xFFFFFFFF);
    }

    private static void key(DrawContext ctx, MinecraftClient mc, String label, KeyBinding bind, int x, int y, int w, int h) {
        boolean down = bind.isPressed();
        ctx.fill(x, y, x + w, y + h, down ? 0xD0FFFFFF : BG);
        ctx.drawCenteredTextWithShadow(mc.textRenderer, label, x + w / 2, y + (h - 8) / 2, down ? 0xFF000000 : 0xFFFFFFFF);
    }

    private static void box(DrawContext ctx, MinecraftClient mc, String top, String bottom, boolean down, int x, int y, int w, int h) {
        ctx.fill(x, y, x + w, y + h, down ? 0xD0FFFFFF : BG);
        int c = down ? 0xFF000000 : 0xFFFFFFFF;
        ctx.getMatrices().push();
        ctx.getMatrices().translate(x + w / 2f, y + 3, 0);
        ctx.drawCenteredTextWithShadow(mc.textRenderer, top, 0, 0, c);
        ctx.getMatrices().scale(0.6f, 0.6f, 1f);
        ctx.drawCenteredTextWithShadow(mc.textRenderer, bottom, 0, 17, down ? 0xFF333333 : 0xFFB9A8FF);
        ctx.getMatrices().pop();
    }
}
