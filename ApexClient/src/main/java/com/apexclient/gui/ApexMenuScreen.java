package com.apexclient.gui;

import com.apexclient.ApexClient;
import com.mojang.blaze3d.systems.RenderSystem;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.option.LanguageOptionsScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/** Apex Client main menu — replaces the vanilla title screen. */
public class ApexMenuScreen extends Screen {

    private static final Identifier LOGO = Identifier.of(ApexClient.MOD_ID, "textures/gui/logo.png");
    private static final int LOGO_TEX_W = 680, LOGO_TEX_H = 256;

    private long openedAt;

    public ApexMenuScreen() {
        super(Text.literal(ApexClient.NAME));
    }

    @Override
    protected void init() {
        openedAt = System.currentTimeMillis();
        int cx = this.width / 2;
        int y = this.height / 2 - 4;
        int w = 200;

        addDrawableChild(ButtonWidget.builder(Text.translatable("menu.singleplayer"),
                b -> client.setScreen(new SelectWorldScreen(this))).dimensions(cx - w / 2, y, w, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.translatable("menu.multiplayer"),
                b -> client.setScreen(new MultiplayerScreen(this))).dimensions(cx - w / 2, y + 24, w, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.translatable("menu.options"),
                b -> client.setScreen(new OptionsScreen(this, client.options))).dimensions(cx - w / 2, y + 48, w / 2 - 2, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.translatable("options.language"),
                b -> client.setScreen(new LanguageOptionsScreen(this, client.options, client.getLanguageManager())))
                .dimensions(cx + 2, y + 48, w / 2 - 2, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.literal("Apex Mods"),
                b -> client.setScreen(new ModMenuScreen(this))).dimensions(cx - w / 2, y + 72, w / 2 - 2, 20).build());
        addDrawableChild(ButtonWidget.builder(Text.translatable("menu.quit"),
                b -> client.scheduleStop()).dimensions(cx + 2, y + 72, w / 2 - 2, 20).build());
    }

    @Override
    public void renderBackground(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.renderBackground(ctx, mouseX, mouseY, delta); // vanilla panorama + blur
        ctx.fillGradient(0, 0, width, height, 0xB0120A24, 0xE0080512);
        // accent line at the bottom
        ctx.fillGradient(0, height - 2, width, height, 0xFF22E3FF, 0xFFD24BFF);
    }

    @Override
    public void render(DrawContext ctx, int mouseX, int mouseY, float delta) {
        super.render(ctx, mouseX, mouseY, delta);

        // logo with a soft fade-in + gentle float
        float t = (System.currentTimeMillis() - openedAt) / 1000f;
        float alpha = Math.min(1f, t / 0.6f);
        int logoW = Math.min(300, width - 40);
        int logoH = logoW * LOGO_TEX_H / LOGO_TEX_W;
        int lx = (width - logoW) / 2;
        int ly = height / 2 - 18 - logoH + (int) (Math.sin(t * 1.6f) * 2);

        RenderSystem.enableBlend();
        ctx.setShaderColor(1f, 1f, 1f, alpha);
        ctx.drawTexture(LOGO, lx, ly, 0, 0, logoW, logoH, logoW, logoH);
        ctx.setShaderColor(1f, 1f, 1f, 1f);
        RenderSystem.disableBlend();

        ctx.drawTextWithShadow(textRenderer, ApexClient.NAME + " " + ApexClient.VERSION + " • Minecraft 1.21.1",
                4, height - 12, 0xFFB9A8FF);
        String user = client.getSession().getUsername();
        ctx.drawTextWithShadow(textRenderer, user, width - textRenderer.getWidth(user) - 4, height - 12, 0xFFFFFFFF);
    }

    @Override
    public boolean shouldCloseOnEsc() {
        return false;
    }
}
