package com.apexclient.gui;

import com.apexclient.ApexClient;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.option.AccessibilityOptionsScreen;
import net.minecraft.client.gui.screen.option.LanguageOptionsScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;
import net.minecraft.text.Text;
import net.minecraft.util.Util;

import java.io.File;

/** Apex Client main menu — replaces the vanilla title screen (blurred panorama, logo, see-through buttons, icon bar). */
public class ApexMenuScreen extends Screen {

    private long openedAt;

    public ApexMenuScreen() {
        super(Text.literal(ApexClient.NAME));
    }

    @Override
    protected void init() {
        openedAt = System.currentTimeMillis();
        int cx = width / 2;
        int bw = Math.min(220, width - 40), bh = 20;
        int top = height / 2 - 4;

        addDrawableChild(new ApexButton(cx - bw / 2, top, bw, bh, "Singleplayer", ApexButton.Style.NORMAL,
                b -> client.setScreen(new SelectWorldScreen(this))));
        addDrawableChild(new ApexButton(cx - bw / 2, top + 25, bw, bh, "Multiplayer", ApexButton.Style.NORMAL,
                b -> client.setScreen(new MultiplayerScreen(this))));
        addDrawableChild(new ApexButton(cx - bw / 2, top + 50, bw, bh, "Apex Mods", ApexButton.Style.ACCENT,
                b -> client.setScreen(new ModMenuScreen(this))));

        // bottom icon bar
        int s = 20, gap = 5, n = 6;
        int bx = cx - (n * s + (n - 1) * gap) / 2, by = height - s - 12;
        addDrawableChild(new ApexButton(bx, by, s, Ui.icon("ui_gear"), "Options",
                b -> client.setScreen(new OptionsScreen(this, client.options))));
        addDrawableChild(new ApexButton(bx + (s + gap), by, s, Ui.icon("ui_globe"), "Language",
                b -> client.setScreen(new LanguageOptionsScreen(this, client.options, client.getLanguageManager()))));
        addDrawableChild(new ApexButton(bx + (s + gap) * 2, by, s, Ui.icon("ui_person"), "Accessibility",
                b -> client.setScreen(new AccessibilityOptionsScreen(this, client.options))));
        addDrawableChild(new ApexButton(bx + (s + gap) * 3, by, s, Ui.icon("ui_camera"), "Screenshots folder",
                b -> openFolder(new File(client.runDirectory, "screenshots"))));
        addDrawableChild(new ApexButton(bx + (s + gap) * 4, by, s, Ui.icon("ui_folder"), "Mods folder",
                b -> openFolder(FabricLoader.getInstance().getGameDir().resolve("mods").toFile())));
        addDrawableChild(new ApexButton(bx + (s + gap) * 5, by, s, Ui.icon("ui_power"), "Quit game",
                b -> client.scheduleStop()));
    }

    private static void openFolder(File dir) {
        if (!dir.exists()) dir.mkdirs();
        Util.getOperatingSystem().open(dir);
    }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.renderBackground(ctx, mouseX, mouseY, delta); // vanilla panorama + blur
        ctx.fillGradient(0, 0, width, height, 0x400C0820, 0x9A06040E);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);

        float t = (System.currentTimeMillis() - openedAt) / 1000f;
        float a = Math.min(1f, t / 0.5f);
        int alpha = (int) (a * 255) << 24;

        // logo + name
        int cx = width / 2;
        int logo = Math.min(64, height / 6);
        int ly = height / 2 - 4 - 34 - logo + (int) (Math.sin(t * 1.4f) * 1.5f);
        Ui.texture(ctx, Ui.EMBLEM, cx - logo / 2, ly, logo, logo, alpha | 0xFFFFFF);
        String title = "APEX CLIENT";
        float sc = 1.6f;
        int tw = (int) (Ui.spacedWidth(textRenderer, title, 1) * sc);
        ctx.getMatrices().push();
        ctx.getMatrices().translate(cx - tw / 2f, ly + logo + 7, 0);
        ctx.getMatrices().scale(sc, sc, 1f);
        int x = 0;
        for (char ch : title.toCharArray()) {
            String c = String.valueOf(ch);
            ctx.drawText(textRenderer, c, x, 0, alpha | 0xFFFFFF, true);
            x += textRenderer.getWidth(c) + 1;
        }
        ctx.getMatrices().pop();

        // footer
        String ver = ApexClient.NAME + " " + ApexClient.VERSION + " · Minecraft 1.21.1";
        ctx.drawText(textRenderer, ver, 6, height - 12, 0xB0B4ADCF, true);
        String user = client.getSession().getUsername();
        ctx.drawText(textRenderer, user, width - textRenderer.getWidth(user) - 6, height - 12, 0xB0FFFFFF, true);
    }

    @Override
    public boolean shouldCloseOnEsc() {
        return false;
    }
}
