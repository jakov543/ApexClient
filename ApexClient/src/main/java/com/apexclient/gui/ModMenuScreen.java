package com.apexclient.gui;

import com.apexclient.ApexClient;
import com.apexclient.ApexConfig;
import com.apexclient.module.Module;
import com.apexclient.module.ModuleManager;
import com.apexclient.module.Setting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.TextFieldWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Right Shift menu: MODS / SETTINGS tabs, profiles, filters, search and mod cards. */
public class ModMenuScreen extends ApexScreen {

    private static final String[] FILTERS = {"ALL", "HUD", "PVP", "VISUAL", "COSMETIC"};
    private static int lastTab = 0;
    private static int lastFilter = 0;

    private final @Nullable Screen parent;
    private int tab = lastTab;          // 0 = mods, 1 = settings
    private int filter = lastFilter;
    private double scroll = 0, maxScroll = 0;
    private TextFieldWidget search;
    private final List<Setting> clientSettings = new ArrayList<>();

    // layout
    private int px, py, pw, ph, lx, lw, rx, rw, gridTop, gridBottom;

    public ModMenuScreen(@Nullable Screen parent) {
        super("Apex Mods");
        this.parent = parent;

        Setting.Bool menu = new Setting.Bool("Apex main menu", true);
        menu.value = ApexConfig.customMainMenu;
        menu.onChange(() -> { ApexConfig.customMainMenu = menu.value; ApexConfig.save(); });
        Setting.Bool rpc = new Setting.Bool("Discord Rich Presence (restart game)", true);
        rpc.value = ApexConfig.discordEnabled;
        rpc.onChange(() -> { ApexConfig.discordEnabled = rpc.value; ApexConfig.save(); });
        Setting.Bool ip = new Setting.Bool("Show server address on Discord", true);
        ip.value = ApexConfig.showServerAddress;
        ip.onChange(() -> { ApexConfig.showServerAddress = ip.value; ApexConfig.save(); });
        Setting.Bool f3 = new Setting.Bool("Show HUD mods on the F3 screen", false);
        f3.value = ApexConfig.hudInDebug;
        f3.onChange(() -> { ApexConfig.hudInDebug = f3.value; ApexConfig.save(); });
        clientSettings.add(menu);
        clientSettings.add(rpc);
        clientSettings.add(ip);
        clientSettings.add(f3);
    }

    @Override
    protected void init() {
        pw = Math.min(width - 16, 560);
        ph = Math.min(height - 16, 330);
        px = (width - pw) / 2;
        py = (height - ph) / 2;
        lx = px + 8;
        lw = pw >= 480 ? 116 : 96;
        rx = lx + lw + 8;
        rw = px + pw - 8 - rx;
        gridTop = py + 60;
        gridBottom = py + ph - 8;

        String old = search == null ? "" : search.getText();
        int sw = Math.min(120, rw / 3);
        search = new TextFieldWidget(textRenderer, rx + rw - sw + 16, py + 42, sw - 20, 10, Text.literal("Search"));
        search.setDrawsBackground(false);
        search.setMaxLength(32);
        search.setText(old);
        search.setPlaceholder(Text.literal("search...").formatted(Formatting.DARK_GRAY));
        search.setChangedListener(s -> scroll = 0);
        addDrawableChild(search);
    }

    private List<Module> visible() {
        String q = search == null ? "" : search.getText().trim().toLowerCase(Locale.ROOT);
        List<Module> out = new ArrayList<>();
        for (Module m : ModuleManager.all()) {
            if (filter > 0 && !m.getCategory().label.equals(FILTERS[filter])) continue;
            if (!q.isEmpty() && !m.getName().toLowerCase(Locale.ROOT).contains(q)
                    && !m.getDescription().toLowerCase(Locale.ROOT).contains(q)) continue;
            out.add(m);
        }
        return out;
    }

    @Override
    protected void renderUi(DrawContext ctx, int mx, int my, float delta) {
        TextRenderer tr = textRenderer;
        search.visible = tab == 0;

        // panel
        Ui.box(ctx, px, py, pw, ph, Ui.PANEL, Ui.PANEL_LINE);

        // header: logo + title
        Ui.texture(ctx, Ui.EMBLEM, px + 10, py + 6, 20, 20, 0xFFFFFFFF);
        Ui.scaled(ctx, tr, "APEX", px + 35, py + 10, 0xFFFFFFFF, 1.25f, true);
        Ui.scaled(ctx, tr, "CLIENT", px + 35 + (int) (tr.getWidth("APEX") * 1.25f) + 4, py + 10, Ui.MUTED, 1.25f, false);

        // tabs
        String[] tabs = {"MODS", "SETTINGS"};
        int tx = px + Math.max(150, pw / 2 - 70);
        for (int i = 0; i < tabs.length; i++) {
            int w = Ui.spacedWidth(tr, tabs[i], 2) + 20;
            boolean sel = tab == i, hot = Ui.in(mx, my, tx, py + 8, w, 17);
            Ui.box(ctx, tx, py + 8, w, 17, sel ? 0x55FFFFFF : hot ? 0x30FFFFFF : 0x18FFFFFF, sel ? 0xAAFFFFFF : 0x50FFFFFF);
            Ui.spaced(ctx, tr, tabs[i], tx + w / 2, py + 13, sel ? Ui.TEXT : Ui.MUTED, 2);
            final int idx = i;
            hit(tx, py + 8, w, 17, () -> { tab = idx; lastTab = idx; scroll = 0; });
            tx += w + 6;
        }

        // close
        int cx = px + pw - 26;
        boolean ch = Ui.in(mx, my, cx, py + 7, 18, 18);
        Ui.box(ctx, cx, py + 7, 18, 18, ch ? 0x55FFFFFF : 0x22FFFFFF, 0x66FFFFFF);
        Ui.texture(ctx, Ui.icon("ui_close"), cx + 4, py + 11, 10, 10, 0xFFFFFFFF);
        hit(cx, py + 7, 18, 18, this::close);

        ctx.fill(px + 1, py + 32, px + pw - 1, py + 33, Ui.PANEL_LINE);

        drawProfiles(ctx, tr, mx, my);
        if (tab == 0) drawMods(ctx, tr, mx, my);
        else drawClientSettings(ctx, tr, mx, my);
    }

    // ------------------------------------------------------------------ left column: profiles
    private void drawProfiles(DrawContext ctx, TextRenderer tr, int mx, int my) {
        int top = py + 40, bottom = py + ph - 8;
        Ui.box(ctx, lx, top, lw, bottom - top, 0x40000000, 0x26FFFFFF);
        Ui.spaced(ctx, tr, "PROFILES", lx + lw / 2, top + 6, Ui.DIM, 1);

        int ry = top + 18;
        List<String> profiles = ModuleManager.profiles();
        String current = ModuleManager.currentProfile();
        int listBottom = bottom - 44;
        for (String name : profiles) {
            if (ry + 16 > listBottom) break;
            boolean sel = name.equals(current), hot = Ui.in(mx, my, lx + 3, ry, lw - 6, 16);
            Ui.box(ctx, lx + 3, ry, lw - 6, 16, sel ? 0x50FFFFFF : hot ? 0x28FFFFFF : 0x12FFFFFF, sel ? 0x99FFFFFF : 0x30FFFFFF);
            Ui.texture(ctx, Ui.icon(sel ? "ui_grid" : "ui_pencil"), lx + 7, ry + 4, 8, 8, sel ? Ui.CYAN : Ui.DIM);
            ctx.drawText(tr, Ui.ellipsize(tr, name, lw - 36), lx + 19, ry + 4, sel ? Ui.TEXT : Ui.MUTED, false);
            final String n = name;
            hit(lx + 3, ry, lw - 6, 16, () -> { ModuleManager.switchProfile(n); scroll = 0; });
            if (!name.equals("Default") && hot) {
                int bx = lx + lw - 17;
                Ui.texture(ctx, Ui.icon("ui_trash"), bx, ry + 4, 8, 8, Ui.in(mx, my, bx - 2, ry, 12, 16) ? 0xFFFF6B7F : Ui.DIM);
                hit(bx - 2, ry, 12, 16, () -> ModuleManager.deleteProfile(n));
            }
            ry += 18;
        }

        // buttons at the bottom
        int by = bottom - 40;
        boolean h1 = Ui.in(mx, my, lx + 3, by, lw - 6, 16);
        Ui.box(ctx, lx + 3, by, lw - 6, 16, h1 ? 0x40FFFFFF : 0x1EFFFFFF, 0x55FFFFFF);
        Ui.scaledCentered(ctx, tr, "SAVE AS NEW PROFILE", lx + lw / 2, by + 5, Ui.MUTED, 0.75f, false);
        hit(lx + 3, by, lw - 6, 16, ModuleManager::createProfile);

        int hy = bottom - 20;
        boolean h2 = Ui.in(mx, my, lx + 3, hy, lw - 6, 16);
        Ui.box(ctx, lx + 3, hy, lw - 6, 16, h2 ? 0xFF4C82EE : Ui.BLUE, 0x99A9C4FF);
        Ui.scaledCentered(ctx, tr, "EDIT HUD LAYOUT", lx + lw / 2, hy + 5, Ui.TEXT, 0.75f, false);
        hit(lx + 3, hy, lw - 6, 16, () -> client.setScreen(new HudEditorScreen(this)));
    }

    // ------------------------------------------------------------------ mods grid
    private void drawMods(DrawContext ctx, TextRenderer tr, int mx, int my) {
        // filters
        int fx = rx, fy = py + 39;
        for (int i = 0; i < FILTERS.length; i++) {
            String f = FILTERS[i];
            int w = Ui.spacedWidth(tr, f, 1) + 14;
            if (fx + w > rx + rw - Math.min(120, rw / 3) - 6) break;
            boolean sel = filter == i, hot = Ui.in(mx, my, fx, fy, w, 16);
            int fill = sel ? (i == 0 ? 0xFF3D7BE8 : 0xFF4B3C9C) : hot ? 0x40FFFFFF : 0x22FFFFFF;
            Ui.box(ctx, fx, fy, w, 16, fill, sel ? 0xAAFFFFFF : 0x44FFFFFF);
            Ui.spaced(ctx, tr, f, fx + w / 2, fy + 4, sel ? Ui.TEXT : Ui.MUTED, 1);
            final int idx = i;
            hit(fx, fy, w, 16, () -> { filter = idx; lastFilter = idx; scroll = 0; });
            fx += w + 4;
        }
        // search box (the text field sits inside it)
        int sw = Math.min(120, rw / 3), sx = rx + rw - sw;
        Ui.box(ctx, sx, fy, sw, 16, search.isFocused() ? 0x40FFFFFF : 0x22FFFFFF, search.isFocused() ? 0xAAFFFFFF : 0x44FFFFFF);
        Ui.texture(ctx, Ui.icon("ui_search"), sx + 4, fy + 4, 8, 8, Ui.MUTED);

        // cards
        List<Module> mods = visible();
        int cols = rw >= 400 ? 3 : 2, gap = 6;
        int cw = (rw - gap * (cols - 1)) / cols, ch = 80;
        int rows = (mods.size() + cols - 1) / cols;
        maxScroll = Math.max(0, rows * (ch + gap) - gap - (gridBottom - gridTop));
        scroll = Math.max(0, Math.min(scroll, maxScroll));

        if (mods.isEmpty()) {
            ctx.drawCenteredTextWithShadow(tr, "No mods found", rx + rw / 2, gridTop + 30, Ui.DIM);
            return;
        }

        ctx.enableScissor(rx, gridTop, rx + rw, gridBottom);
        for (int i = 0; i < mods.size(); i++) {
            int cx = rx + (i % cols) * (cw + gap);
            int cy = gridTop + (i / cols) * (ch + gap) - (int) scroll;
            if (cy + ch < gridTop || cy > gridBottom) continue;
            drawCard(ctx, tr, mods.get(i), cx, cy, cw, ch, mx, my);
        }
        ctx.disableScissor();

        if (maxScroll > 0) {
            int track = gridBottom - gridTop;
            int bar = Math.max(20, track * track / (track + (int) maxScroll));
            int by = gridTop + (int) ((track - bar) * (scroll / maxScroll));
            ctx.fill(rx + rw + 2, by, rx + rw + 4, by + bar, 0x80FFFFFF);
        }
    }

    private void drawCard(DrawContext ctx, TextRenderer tr, Module m, int x, int y, int w, int h, int mx, int my) {
        boolean inGrid = my >= gridTop && my < gridBottom;
        boolean hot = inGrid && Ui.in(mx, my, x, y, w, h);
        Ui.box(ctx, x, y, w, h, hot ? Ui.CARD_HOVER : Ui.CARD, hot ? 0x66FFFFFF : 0x30FFFFFF);

        // icon + name (click toggles)
        Ui.texture(ctx, m.getIcon(), x + w / 2 - 12, y + 7, 24, 24, m.isEnabled() ? 0xFFFFFFFF : 0x99FFFFFF);
        String name = Ui.ellipsize(tr, m.getName(), (int) ((w - 8) / 1.1f));
        Ui.scaledCentered(ctx, tr, name, x + w / 2, y + 35, m.isEnabled() ? 0xFFE6E1FA : Ui.DIM, 1.1f, false);
        if (inGrid && visibleRow(y, h)) hit(x, y, w, 46, () -> { m.toggle(); ModuleManager.save(); });

        // OPTIONS + gear
        int oy = y + h - 31, oh = 14;
        boolean ho = inGrid && Ui.in(mx, my, x + 3, oy, w - 22, oh);
        Ui.box(ctx, x + 3, oy, w - 22, oh, ho ? 0x55FFFFFF : 0x2CFFFFFF, 0x50FFFFFF);
        Ui.spaced(ctx, tr, "OPTIONS", x + 3 + (w - 22) / 2, oy + 3, Ui.TEXT, 2);
        boolean hg = inGrid && Ui.in(mx, my, x + w - 17, oy, 14, oh);
        Ui.box(ctx, x + w - 17, oy, 14, oh, hg ? 0x55FFFFFF : 0x2CFFFFFF, 0x50FFFFFF);
        Ui.texture(ctx, Ui.icon("ui_gear"), x + w - 14, oy + 3, 8, 8, Ui.TEXT);
        if (inGrid && visibleRow(y, h)) {
            hit(x + 3, oy, w - 22, oh, () -> client.setScreen(new ModuleOptionsScreen(this, m)));
            hit(x + w - 17, oy, 14, oh, () -> client.setScreen(new ModuleOptionsScreen(this, m)));
        }

        // ENABLED / DISABLED
        int ey = y + h - 15, eh = 13;
        boolean he = inGrid && Ui.in(mx, my, x + 3, ey, w - 6, eh);
        int fill = m.isEnabled() ? (he ? Ui.GREEN_HOVER : Ui.GREEN) : (he ? Ui.RED_HOVER : Ui.RED);
        Ui.box(ctx, x + 3, ey, w - 6, eh, fill, 0x40FFFFFF);
        Ui.spaced(ctx, tr, m.isEnabled() ? "ENABLED" : "DISABLED", x + w / 2, ey + 3, Ui.TEXT, 2);
        if (inGrid && visibleRow(y, h)) hit(x + 3, ey, w - 6, eh, () -> { m.toggle(); ModuleManager.save(); });
    }

    private boolean visibleRow(int y, int h) {
        return y + h > gridTop && y < gridBottom;
    }

    // ------------------------------------------------------------------ client settings tab
    private void drawClientSettings(DrawContext ctx, TextRenderer tr, int mx, int my) {
        ctx.drawText(tr, "Client settings", rx, py + 42, Ui.TEXT, true);
        ctx.drawText(tr, "Apex Client " + ApexClient.VERSION + " · Minecraft 1.21.1", rx + rw - tr.getWidth("Apex Client " + ApexClient.VERSION + " · Minecraft 1.21.1"), py + 42, Ui.DIM, false);
        drawSettings(ctx, clientSettings, rx, gridTop, rw, gridTop, gridBottom, mx, my, () -> {});
        int ty = gridTop + clientSettings.size() * ROW + 10;
        ctx.drawText(tr, "Keys: Right Shift = this menu · C = zoom (Options → Controls to change)", rx, ty, Ui.DIM, false);
    }

    // ------------------------------------------------------------------ input
    @Override
    public boolean mouseScrolled(double mx, double my, double h, double v) {
        scroll = Math.max(0, Math.min(maxScroll, scroll - v * 24));
        return true;
    }

    @Override
    public boolean keyPressed(int key, int scan, int mods) {
        if (!search.isFocused() && ApexClient.menuKey != null && ApexClient.menuKey.matchesKey(key, scan)) {
            close();
            return true;
        }
        return super.keyPressed(key, scan, mods);
    }

    @Override
    public void close() {
        ModuleManager.save();
        client.setScreen(parent);
    }

    @Override
    public boolean shouldPause() { return false; }
}
