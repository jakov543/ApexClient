package com.apexclient.gui;

import com.apexclient.ApexClient;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.sound.PositionedSoundInstance;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Identifier;

/** Drawing helpers + colours shared by the Apex menus. */
public final class Ui {

    // palette
    public static final int PANEL = 0xD80C0916;
    public static final int PANEL_LINE = 0x33FFFFFF;
    public static final int CARD = 0x8C1C1630;
    public static final int CARD_HOVER = 0xB02A2148;
    public static final int BUTTON = 0x40FFFFFF;
    public static final int BUTTON_HOVER = 0x66FFFFFF;
    public static final int ACCENT = 0xFF7C5CFF;
    public static final int CYAN = 0xFF2EE6FF;
    public static final int PINK = 0xFFFF4FD8;
    public static final int GREEN = 0xFF22A35A;
    public static final int GREEN_HOVER = 0xFF2BC06C;
    public static final int RED = 0xFFB0283F;
    public static final int RED_HOVER = 0xFFCC324B;
    public static final int BLUE = 0xFF3B6FD8;
    public static final int TEXT = 0xFFFFFFFF;
    public static final int MUTED = 0xFFB4ADCF;
    public static final int DIM = 0xFF7D769A;

    public static final Identifier EMBLEM = id("textures/gui/emblem.png");

    private Ui() {}

    public static Identifier id(String path) { return Identifier.of(ApexClient.MOD_ID, path); }
    public static Identifier icon(String name) { return id("textures/icons/" + name + ".png"); }

    public static boolean in(double mx, double my, int x, int y, int w, int h) {
        return mx >= x && mx < x + w && my >= y && my < y + h;
    }

    public static void border(DrawContext ctx, int x, int y, int w, int h, int color) {
        ctx.fill(x, y, x + w, y + 1, color);
        ctx.fill(x, y + h - 1, x + w, y + h, color);
        ctx.fill(x, y + 1, x + 1, y + h - 1, color);
        ctx.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
    }

    /** Box with a 1px lighter outline and slightly cut corners (looks rounded at GUI scale). */
    public static void box(DrawContext ctx, int x, int y, int w, int h, int fill, int line) {
        ctx.fill(x + 1, y, x + w - 1, y + h, fill);
        ctx.fill(x, y + 1, x + 1, y + h - 1, fill);
        ctx.fill(x + w - 1, y + 1, x + w, y + h - 1, fill);
        if (line != 0) {
            ctx.fill(x + 1, y, x + w - 1, y + 1, line);
            ctx.fill(x + 1, y + h - 1, x + w - 1, y + h, line);
            ctx.fill(x, y + 1, x + 1, y + h - 1, line);
            ctx.fill(x + w - 1, y + 1, x + w, y + h - 1, line);
        }
    }

    /** Draws a texture (icons are white, so color tints them). */
    public static void texture(DrawContext ctx, Identifier tex, int x, int y, int w, int h, int color) {
        float a = ((color >>> 24) & 0xFF) / 255f, r = ((color >> 16) & 0xFF) / 255f, g = ((color >> 8) & 0xFF) / 255f, b = (color & 0xFF) / 255f;
        RenderSystem.enableBlend();
        ctx.setShaderColor(r, g, b, a);
        ctx.drawTexture(tex, x, y, 0, 0, w, h, w, h);
        ctx.setShaderColor(1f, 1f, 1f, 1f);
        RenderSystem.disableBlend();
    }

    /** UPPERCASE text with letter spacing, centred on cx. */
    public static void spaced(DrawContext ctx, TextRenderer tr, String text, int cx, int y, int color, int spacing) {
        int w = spacedWidth(tr, text, spacing);
        int x = cx - w / 2;
        for (int i = 0; i < text.length(); i++) {
            String c = String.valueOf(text.charAt(i));
            ctx.drawText(tr, c, x, y, color, false);
            x += tr.getWidth(c) + spacing;
        }
    }

    public static int spacedWidth(TextRenderer tr, String text, int spacing) {
        int w = 0;
        for (int i = 0; i < text.length(); i++) w += tr.getWidth(String.valueOf(text.charAt(i))) + spacing;
        return Math.max(0, w - spacing);
    }

    /** Text drawn at a scale, centred on cx. */
    public static void scaledCentered(DrawContext ctx, TextRenderer tr, String text, int cx, int y, int color, float scale, boolean shadow) {
        ctx.getMatrices().push();
        ctx.getMatrices().translate(cx, y, 0);
        ctx.getMatrices().scale(scale, scale, 1f);
        ctx.drawText(tr, text, -tr.getWidth(text) / 2, 0, color, shadow);
        ctx.getMatrices().pop();
    }

    public static void scaled(DrawContext ctx, TextRenderer tr, String text, int x, int y, int color, float scale, boolean shadow) {
        ctx.getMatrices().push();
        ctx.getMatrices().translate(x, y, 0);
        ctx.getMatrices().scale(scale, scale, 1f);
        ctx.drawText(tr, text, 0, 0, color, shadow);
        ctx.getMatrices().pop();
    }

    public static String ellipsize(TextRenderer tr, String text, int maxWidth) {
        if (tr.getWidth(text) <= maxWidth) return text;
        while (text.length() > 1 && tr.getWidth(text + "…") > maxWidth) text = text.substring(0, text.length() - 1);
        return text + "…";
    }

    public static void click() {
        MinecraftClient.getInstance().getSoundManager().play(PositionedSoundInstance.master(SoundEvents.UI_BUTTON_CLICK, 1.0f));
    }
}
