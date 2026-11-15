package com.apexclient.gui;

import com.apexclient.module.Setting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.ArrayList;
import java.util.List;
import java.util.function.DoubleConsumer;

/**
 * Base for the Apex menus. Custom parts are drawn in {@link #renderUi} (between the blurred
 * background and the real widgets) and register click areas with {@link #hit} / {@link #slider}.
 */
public abstract class ApexScreen extends Screen {

    private record Hit(int x, int y, int w, int h, Runnable click, DoubleConsumer drag) {}

    private final List<Hit> hits = new ArrayList<>();
    private Hit dragging;

    protected ApexScreen(String title) {
        super(Text.literal(title));
    }

    /** Draw the custom UI here. */
    protected abstract void renderUi(DrawContext ctx, int mouseX, int mouseY, float delta);

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.renderBackground(ctx, mouseX, mouseY, delta); // panorama/world + blur
        hits.clear();
        renderUi(ctx, mouseX, mouseY, delta);
    }

    protected void hit(int x, int y, int w, int h, Runnable onClick) {
        hits.add(new Hit(x, y, w, h, onClick, null));
    }

    /** A draggable area; receives 0..1 for the mouse position across its width. */
    protected void slider(int x, int y, int w, int h, DoubleConsumer onValue) {
        hits.add(new Hit(x, y, w, h, null, onValue));
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        if (super.mouseClicked(mx, my, button)) return true;
        if (button != 0) return false;
        for (int i = hits.size() - 1; i >= 0; i--) {
            Hit h = hits.get(i);
            if (!Ui.in(mx, my, h.x, h.y, h.w, h.h)) continue;
            setFocused(null);
            if (h.drag != null) {
                dragging = h;
                h.drag.accept((mx - h.x) / (double) h.w);
            } else {
                Ui.click();
                h.click.run();
            }
            return true;
        }
        setFocused(null);
        return false;
    }

    @Override
    public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging != null) {
            dragging.drag.accept((mx - dragging.x) / (double) dragging.w);
            return true;
        }
        return super.mouseDragged(mx, my, button, dx, dy);
    }

    @Override
    public boolean mouseReleased(double mx, double my, int button) {
        if (dragging != null) {
            dragging = null;
            onSliderReleased();
            return true;
        }
        return super.mouseReleased(mx, my, button);
    }

    /** Called after a slider drag ends (e.g. to save). */
    protected void onSliderReleased() {}

    // ------------------------------------------------------------------ settings rows

    public static final int ROW = 24;

    /**
     * Draws a list of settings (switches, sliders, pickers) and registers their click areas.
     * Rows outside [clipTop, clipBottom] are skipped. Returns the total height.
     */
    protected int drawSettings(DrawContext ctx, List<Setting> list, int x, int y, int w,
                               int clipTop, int clipBottom, int mx, int my, Runnable onChanged) {
        TextRenderer tr = textRenderer;
        int ry = y;
        for (Setting s : list) {
            if (ry + ROW > clipTop && ry < clipBottom) {
                boolean hover = Ui.in(mx, my, x, ry, w, ROW) && my >= clipTop && my < clipBottom;
                ctx.fill(x, ry, x + w, ry + ROW - 2, hover ? 0x40FFFFFF : 0x22FFFFFF);
                ctx.drawText(tr, s.name, x + 8, ry + 7, Ui.TEXT, false);
                int right = x + w - 8;

                if (s instanceof Setting.Bool b) {
                    int sw = 26, sh = 12, sx = right - sw, sy = ry + 5;
                    ctx.fill(sx, sy, sx + sw, sy + sh, b.value ? Ui.GREEN : 0xFF4A4460);
                    int kx = b.value ? sx + sw - 11 : sx + 1;
                    ctx.fill(kx, sy + 1, kx + 10, sy + sh - 1, 0xFFFFFFFF);
                    String st = b.value ? "ON" : "OFF";
                    ctx.drawText(tr, st, sx - 6 - tr.getWidth(st), ry + 7, b.value ? 0xFF4FF0A8 : Ui.DIM, false);
                    if (visible(ry, clipTop, clipBottom)) hit(x, ry, w, ROW - 2, () -> { b.toggle(); onChanged.run(); });

                } else if (s instanceof Setting.Slider sl) {
                    int tw = Math.min(120, w / 2 - 20), tx = right - tw, ty = ry + 10;
                    ctx.fill(tx, ty, tx + tw, ty + 3, 0xFF3A3452);
                    int fx = tx + (int) Math.round(tw * sl.fraction());
                    ctx.fill(tx, ty, fx, ty + 3, Ui.ACCENT);
                    ctx.fill(fx - 2, ty - 3, fx + 3, ty + 6, 0xFFFFFFFF);
                    String v = sl.display();
                    ctx.drawText(tr, v, tx - 8 - tr.getWidth(v), ry + 7, Ui.MUTED, false);
                    if (visible(ry, clipTop, clipBottom)) slider(tx - 3, ry, tw + 6, ROW - 2, t -> { sl.setFraction(t); onChanged.run(); });

                } else if (s instanceof Setting.Choice c) {
                    String v = c.display();
                    int bw = Math.max(70, tr.getWidth(v) + 34), bx = right - bw;
                    Ui.box(ctx, bx, ry + 3, bw, 16, 0x30FFFFFF, 0x50FFFFFF);
                    ctx.drawText(tr, "<", bx + 5, ry + 7, Ui.MUTED, false);
                    ctx.drawText(tr, ">", bx + bw - 10, ry + 7, Ui.MUTED, false);
                    int color = (c instanceof Setting.Colour col) ? col.color(bx) : Ui.TEXT;
                    if (c instanceof Setting.Colour) ctx.fill(bx + 14, ry + 8, bx + 20, ry + 14, color);
                    ctx.drawCenteredTextWithShadow(tr, v, bx + bw / 2 + (c instanceof Setting.Colour ? 4 : 0), ry + 7, color);
                    if (visible(ry, clipTop, clipBottom)) {
                        hit(bx, ry, bw / 2, ROW - 2, () -> { c.prev(); onChanged.run(); });
                        hit(bx + bw / 2, ry, bw - bw / 2, ROW - 2, () -> { c.next(); onChanged.run(); });
                    }
                }
            }
            ry += ROW;
        }
        return ry - y;
    }

    private static boolean visible(int ry, int top, int bottom) {
        return ry >= top - 2 && ry + ROW <= bottom + 2;
    }
}
