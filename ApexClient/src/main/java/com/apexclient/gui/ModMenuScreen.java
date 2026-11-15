package com.apexclient.gui;

import com.apexclient.ApexClient;
import com.apexclient.module.Module;
import com.apexclient.module.ModuleManager;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

/** Lunar-style mod menu (Right Shift): category tabs + grid of mod cards with ON/OFF switches. */
public class ModMenuScreen extends Screen {

    private static final Identifier LOGO = Identifier.of(ApexClient.MOD_ID, "textures/gui/logo.png");
    private static final String[] TABS = {"All", "HUD", "PvP", "Visual", "Cosmetic"};

    private static final int PANEL_BG = 0xF0100A1E;
    private static final int CARD_BG = 0xFF1B1430;
    private static final int CARD_HOVER = 0xFF261C44;
    private static final int ACCENT = 0xFF7B5CFF;
    private static final int ACCENT2 = 0xFF22E3FF;
    private static final int MUTED = 0xFF8F86B0;

    private final @Nullable Screen parent;
    private int tab = 0;
    private double scroll = 0;

    // panel layout (computed in init)
    private int px, py, pw, ph, gridTop, gridBottom;
    private static final int COLS = 3, CARD_H = 46, GAP = 6;

    public ModMenuScreen(@Nullable Screen parent) {
        super(Text.literal("Apex Mods"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        pw = Math.min(420, width - 20);
        ph = Math.min(280, height - 20);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        gridTop = py + 52;
        gridBottom = py + ph - 32;

        addDrawableChild(ButtonWidget.builder(Text.literal("Edit HUD Layout"),
                b -> client.setScreen(new HudEditorScreen(this))).dimensions(px + 10, py + ph - 26, 120, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Done"),
                b -> close()).dimensions(px + pw - 90, py + ph - 26, 80, 20).build());
    }

    private List<Module> visibleModules() {
        List<Module> list = new ArrayList<>();
        for (Module m : ModuleManager.all()) {
            if (tab == 0 || m.getCategory().ordinal() == tab - 1) list.add(m);
        }
        return list;
    }

    private int cardW() { return (pw - 20 - GAP * (COLS - 1)) / COLS; }

    private int maxScroll() {
        int rows = (visibleModules().size() + COLS - 1) / COLS;
        return Math.max(0, rows * (CARD_H + GAP) - GAP - (gridBottom - gridTop));
    }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.renderBackground(ctx, mouseX, mouseY, delta);
        // panel (drawn here so the buttons render on top of it)
        ctx.fill(px, py, px + pw, py + ph, PANEL_BG);
        ctx.fillGradient(px, py, px + pw, py + 2, ACCENT2, ACCENT);
        drawBorder(ctx, px, py, pw, ph, 0x40FFFFFF);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta); // background + panel + buttons

        // header
        RenderSystem.enableBlend();
        ctx.drawTexture(LOGO, px + 8, py + 6, 0, 0, 64, 24, 64, 24);
        RenderSystem.disableBlend();
        ctx.drawTextWithShadow(textRenderer, "MODS", px + 78, py + 14, 0xFFFFFFFF);

        // tabs
        int tx = px + pw - 8;
        for (int i = TABS.length - 1; i >= 0; i--) {
            int tw = textRenderer.getWidth(TABS[i]) + 12;
            tx -= tw;
            boolean sel = i == tab;
            boolean hover = in(mouseX, mouseY, tx, py + 8, tw, 18);
            ctx.fill(tx, py + 8, tx + tw, py + 26, sel ? ACCENT : hover ? CARD_HOVER : CARD_BG);
            ctx.drawCenteredTextWithShadow(textRenderer, TABS[i], tx + tw / 2, py + 13, sel ? 0xFFFFFFFF : MUTED);
            tx -= 4;
        }
        ctx.fill(px + 8, py + 36, px + pw - 8, py + 37, 0x30FFFFFF);
        ctx.drawTextWithShadow(textRenderer, "Click a mod to turn it on or off", px + 10, py + 40, MUTED);

        // grid
        scroll = Math.max(0, Math.min(scroll, maxScroll()));
        ctx.enableScissor(px, gridTop, px + pw, gridBottom);
        List<Module> mods = visibleModules();
        int cw = cardW();
        for (int i = 0; i < mods.size(); i++) {
            Module m = mods.get(i);
            int cx = px + 10 + (i % COLS) * (cw + GAP);
            int cy = gridTop + (i / COLS) * (CARD_H + GAP) - (int) scroll;
            if (cy + CARD_H < gridTop || cy > gridBottom) continue;
            boolean hover = in(mouseX, mouseY, cx, cy, cw, CARD_H) && mouseY >= gridTop && mouseY <= gridBottom;
            drawCard(ctx, m, cx, cy, cw, hover);
        }
        ctx.disableScissor();

        // scrollbar
        int max = maxScroll();
        if (max > 0) {
            int track = gridBottom - gridTop;
            int bar = Math.max(20, track * track / (track + max));
            int by = gridTop + (int) ((track - bar) * (scroll / max));
            ctx.fill(px + pw - 5, by, px + pw - 3, by + bar, 0x80FFFFFF);
        }
    }

    private void drawCard(DrawContext ctx, Module m, int x, int y, int w, boolean hover) {
        ctx.fill(x, y, x + w, y + CARD_H, hover ? CARD_HOVER : CARD_BG);
        if (m.isEnabled()) ctx.fill(x, y, x + 2, y + CARD_H, ACCENT);
        ctx.drawTextWithShadow(textRenderer, m.getName(), x + 7, y + 6, 0xFFFFFFFF);

        // description, wrapped to two lines, drawn small
        var lines = textRenderer.wrapLines(Text.literal(m.getDescription()), (int) ((w - 12) / 0.75f));
        ctx.getMatrices().push();
        ctx.getMatrices().translate(x + 7, y + 18, 0);
        ctx.getMatrices().scale(0.75f, 0.75f, 1f);
        for (int l = 0; l < Math.min(2, lines.size()); l++) {
            ctx.drawTextWithShadow(textRenderer, lines.get(l), 0, l * 10, MUTED);
        }
        ctx.getMatrices().pop();

        // switch
        int sw = 22, sh = 10, sx = x + w - sw - 6, sy = y + 6;
        ctx.fill(sx, sy, sx + sw, sy + sh, m.isEnabled() ? ACCENT : 0xFF3A3352);
        int knob = m.isEnabled() ? sx + sw - 9 : sx + 1;
        ctx.fill(knob, sy + 1, knob + 8, sy + sh - 1, 0xFFFFFFFF);

        String cat = m.getCategory().name();
        ctx.getMatrices().push();
        ctx.getMatrices().translate(x + w - 6, y + CARD_H - 9, 0);
        ctx.getMatrices().scale(0.6f, 0.6f, 1f);
        ctx.drawTextWithShadow(textRenderer, cat, -textRenderer.getWidth(cat), 0, m.isEnabled() ? ACCENT2 : 0xFF5C5478);
        ctx.getMatrices().pop();
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (super.mouseClicked(mx, my, button)) return true;
        // tabs
        int tx = px + pw - 8;
        for (int i = TABS.length - 1; i >= 0; i--) {
            int tw = textRenderer.getWidth(TABS[i]) + 12;
            tx -= tw;
            if (in(mx, my, tx, py + 8, tw, 18)) { tab = i; scroll = 0; return true; }
            tx -= 4;
        }
        // cards
        if (my < gridTop || my > gridBottom) return false;
        List<Module> mods = visibleModules();
        int cw = cardW();
        for (int i = 0; i < mods.size(); i++) {
            int cx = px + 10 + (i % COLS) * (cw + GAP);
            int cy = gridTop + (i / COLS) * (CARD_H + GAP) - (int) scroll;
            if (in(mx, my, cx, cy, cw, CARD_H)) {
                mods.get(i).toggle();
                ModuleManager.save();
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double horizontal, double vertical) {
        scroll -= vertical * 20;
        return true;
    }

    @Override
    public void close() {
        ModuleManager.save();
        client.setScreen(parent);
    }

    @Override
    public boolean shouldPause() { return false; }

    private static boolean in(double mx, double my, int x, int y, int w, int h) {
        return mx >= x && mx < x + w && my >= y && my < y + h;
    }

    static void drawBorder(DrawContext ctx, int x, int y, int w, int h, int color) {
        ctx.fill(x, y, x + w, y + 1, color);
        ctx.fill(x, y + h - 1, x + w, y + h, color);
        ctx.fill(x, y, x + 1, y + h, color);
        ctx.fill(x + w - 1, y, x + w, y + h, color);
    }
}
