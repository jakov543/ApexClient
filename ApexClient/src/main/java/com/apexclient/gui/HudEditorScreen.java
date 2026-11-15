package com.apexclient.gui;

import com.apexclient.module.HudModule;
import com.apexclient.module.ModuleManager;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

import java.util.List;

/** Drag HUD elements around. Snaps to screen edges and center. ESC saves and goes back. */
public class HudEditorScreen extends Screen {

    private static final int SNAP = 4;

    private final Screen parent;
    private HudModule dragging;
    private int offX, offY;
    private boolean snapX, snapY;

    public HudEditorScreen(Screen parent) {
        super(Text.literal("Edit HUD"));
        this.parent = parent;
    }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        if (client.world == null) super.renderBackground(ctx, mouseX, mouseY, delta);
        else ctx.fill(0, 0, width, height, 0x50000000); // keep the world visible, no blur
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);

        // center guides while dragging
        if (dragging != null) {
            if (snapX) ctx.fill(width / 2, 0, width / 2 + 1, height, 0x807B5CFF);
            if (snapY) ctx.fill(0, height / 2, width, height / 2 + 1, 0x807B5CFF);
        }

        for (HudModule h : enabled()) {
            h.clamp(width, height, client);
            h.draw(ctx, client, h.x, h.y, true);
            boolean hover = h == dragging || hit(h, mouseX, mouseY);
            ModMenuScreen.drawBorder(ctx, h.x - 1, h.y - 1, h.getWidth(client) + 2, h.getHeight(client) + 2,
                    hover ? 0xFF22E3FF : 0x807B5CFF);
        }

        String hint = "Drag elements to move them  •  ESC to save";
        int w = textRenderer.getWidth(hint) + 16;
        ctx.fill(width / 2 - w / 2, height - 24, width / 2 + w / 2, height - 8, 0xC0100A1E);
        ctx.drawCenteredTextWithShadow(textRenderer, hint, width / 2, height - 20, 0xFFFFFFFF);
    }

    private List<HudModule> enabled() {
        return ModuleManager.hud().stream().filter(HudModule::isEnabled).toList();
    }

    private boolean hit(HudModule h, double mx, double my) {
        return mx >= h.x && mx < h.x + h.getWidth(client) && my >= h.y && my < h.y + h.getHeight(client);
    }

    @Override
    public boolean mouseClicked(double mx, double my, int button) {
        List<HudModule> list = enabled();
        for (int i = list.size() - 1; i >= 0; i--) {
            HudModule h = list.get(i);
            if (hit(h, mx, my)) {
                dragging = h;
                offX = (int) mx - h.x;
                offY = (int) my - h.y;
                return true;
            }
        }
        return super.mouseClicked(mx, my, button);
    }

    @Override
    public boolean mouseDragged(double mx, double my, int button, double dx, double dy) {
        if (dragging == null) return super.mouseDragged(mx, my, button, dx, dy);
        int w = dragging.getWidth(client), h = dragging.getHeight(client);
        int nx = (int) mx - offX, ny = (int) my - offY;

        // snap to edges and center
        snapX = Math.abs(nx + w / 2 - width / 2) < SNAP;
        snapY = Math.abs(ny + h / 2 - height / 2) < SNAP;
        if (snapX) nx = width / 2 - w / 2;
        if (snapY) ny = height / 2 - h / 2;
        if (Math.abs(nx) < SNAP) nx = 0;
        if (Math.abs(ny) < SNAP) ny = 0;
        if (Math.abs(nx + w - width) < SNAP) nx = width - w;
        if (Math.abs(ny + h - height) < SNAP) ny = height - h;

        dragging.x = nx;
        dragging.y = ny;
        dragging.clamp(width, height, client);
        return true;
    }

    @Override
    public boolean mouseReleased(double mx, double my, int button) {
        if (dragging != null) {
            dragging = null;
            ModuleManager.save();
            return true;
        }
        return super.mouseReleased(mx, my, button);
    }

    @Override
    public void close() {
        ModuleManager.save();
        client.setScreen(parent);
    }

    @Override
    public boolean shouldPause() { return false; }
}
