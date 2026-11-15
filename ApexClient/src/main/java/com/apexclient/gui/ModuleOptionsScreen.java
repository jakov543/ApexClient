package com.apexclient.gui;

import com.apexclient.module.HudModule;
import com.apexclient.module.Module;
import com.apexclient.module.ModuleManager;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;

/** OPTIONS for one mod: on/off, every setting, reset, and a live preview for HUD mods. */
public class ModuleOptionsScreen extends ApexScreen {

    private final Screen parent;
    private final Module module;
    private double scroll = 0, maxScroll = 0;
    private int px, py, pw, ph;

    public ModuleOptionsScreen(Screen parent, Module module) {
        super(module.getName());
        this.parent = parent;
        this.module = module;
    }

    @Override
    protected void init() {
        pw = Math.min(width - 16, 520);
        ph = Math.min(height - 16, 300);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
    }

    @Override
    protected void renderUi(DrawContext ctx, int mx, int my, float delta) {
        TextRenderer tr = textRenderer;
        Ui.box(ctx, px, py, pw, ph, Ui.PANEL, Ui.PANEL_LINE);

        // back
        boolean hb = Ui.in(mx, my, px + 8, py + 8, 18, 18);
        Ui.box(ctx, px + 8, py + 8, 18, 18, hb ? 0x55FFFFFF : 0x22FFFFFF, 0x66FFFFFF);
        Ui.texture(ctx, Ui.icon("ui_back"), px + 12, py + 12, 10, 10, Ui.TEXT);
        hit(px + 8, py + 8, 18, 18, this::close);

        // title
        Ui.texture(ctx, module.getIcon(), px + 34, py + 7, 20, 20, Ui.TEXT);
        Ui.scaled(ctx, tr, module.getName(), px + 60, py + 9, Ui.TEXT, 1.25f, true);
        ctx.drawText(tr, module.getCategory().label + " · " + module.getDescription(), px + 60, py + 22, Ui.DIM, false);

        // enabled toggle + reset (top right)
        int ew = 74, ex = px + pw - ew - 8;
        boolean he = Ui.in(mx, my, ex, py + 9, ew, 16);
        int fill = module.isEnabled() ? (he ? Ui.GREEN_HOVER : Ui.GREEN) : (he ? Ui.RED_HOVER : Ui.RED);
        Ui.box(ctx, ex, py + 9, ew, 16, fill, 0x50FFFFFF);
        Ui.spaced(ctx, tr, module.isEnabled() ? "ENABLED" : "DISABLED", ex + ew / 2, py + 13, Ui.TEXT, 2);
        hit(ex, py + 9, ew, 16, () -> { module.toggle(); ModuleManager.save(); });

        int rwid = 58, rx = ex - rwid - 6;
        boolean hr = Ui.in(mx, my, rx, py + 9, rwid, 16);
        Ui.box(ctx, rx, py + 9, rwid, 16, hr ? 0x55FFFFFF : 0x22FFFFFF, 0x55FFFFFF);
        Ui.texture(ctx, Ui.icon("ui_reset"), rx + 5, py + 13, 8, 8, Ui.MUTED);
        Ui.spaced(ctx, tr, "RESET", rx + rwid / 2 + 5, py + 13, Ui.MUTED, 1);
        hit(rx, py + 9, rwid, 16, () -> { module.resetToDefaults(); ModuleManager.save(); });

        ctx.fill(px + 1, py + 34, px + pw - 1, py + 35, Ui.PANEL_LINE);

        // layout: settings left, preview right for HUD mods
        boolean preview = module instanceof HudModule && pw >= 420;
        int lx = px + 10, top = py + 42, bottom = py + ph - 10;
        int lw = preview ? (int) (pw * 0.56) : pw - 20;

        if (module.getSettings().isEmpty()) {
            ctx.drawText(tr, "This mod has no options — just turn it on or off.", lx, top + 6, Ui.MUTED, false);
        } else {
            maxScroll = Math.max(0, module.getSettings().size() * ROW - (bottom - top));
            scroll = Math.max(0, Math.min(scroll, maxScroll));
            ctx.enableScissor(lx, top, lx + lw, bottom);
            drawSettings(ctx, module.getSettings(), lx, top - (int) scroll, lw, top, bottom, mx, my, () -> {});
            ctx.disableScissor();
        }

        if (preview) {
            HudModule h = (HudModule) module;
            int vx = lx + lw + 10, vw = px + pw - 10 - vx, vh = bottom - top;
            Ui.box(ctx, vx, top, vw, vh, 0x50000000, 0x30FFFFFF);
            Ui.spaced(ctx, tr, "PREVIEW", vx + vw / 2, top + 6, Ui.DIM, 2);
            int ew2 = h.scaledWidth(client), eh2 = h.scaledHeight(client);
            int ox = h.x, oy = h.y;
            h.x = vx + (vw - ew2) / 2;
            h.y = top + 18 + Math.max(0, (vh - 18 - eh2) / 2);
            ctx.enableScissor(vx + 1, top + 16, vx + vw - 1, top + vh - 1);
            h.renderScaled(ctx, client, true);
            ctx.disableScissor();
            h.x = ox;
            h.y = oy;
        }
    }

    @Override
    protected void onSliderReleased() { ModuleManager.save(); }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        boolean r = super.mouseClicked(mx, my, button);
        if (r) ModuleManager.save();
        return r;
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double h, double v) {
        scroll = Math.max(0, Math.min(maxScroll, scroll - v * 20));
        return true;
    }

    @Override
    public void close() {
        ModuleManager.save();
        client.setScreen(parent);
    }

    @Override
    public boolean shouldPause() { return false; }
}
