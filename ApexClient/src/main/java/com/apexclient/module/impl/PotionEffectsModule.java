package com.apexclient.module.impl;

import com.apexclient.module.HudModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.texture.Sprite;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.util.StringHelper;

import java.util.ArrayList;
import java.util.List;

/** Active potion effects with icon and time left. */
public class PotionEffectsModule extends HudModule {

    public final com.apexclient.module.Setting.Bool showIcons = add(new com.apexclient.module.Setting.Bool("Show icons", true));

    public PotionEffectsModule() { super("Potion Effects", "Active effects with time left", true, 4, 290); }

    private List<StatusEffectInstance> effects(MinecraftClient mc) {
        return mc.player == null ? List.of() : new ArrayList<>(mc.player.getStatusEffects());
    }

    @Override
    public int getWidth(MinecraftClient mc) { return 110; }

    @Override
    public int getHeight(MinecraftClient mc) { return Math.max(1, effects(mc).size()) * 20; }

    @Override
    public void draw(DrawContext ctx, MinecraftClient mc, int x, int y, boolean preview) {
        List<StatusEffectInstance> list = effects(mc);
        if (list.isEmpty()) {
            if (preview) {
                if (background.value) ctx.fill(x, y, x + getWidth(mc), y + 20, BG);
                ctx.drawTextWithShadow(mc.textRenderer, "Speed II", x + 22, y + 2, 0xFFFFFFFF);
                ctx.drawTextWithShadow(mc.textRenderer, "1:30", x + 22, y + 11, 0xFFB9A8FF);
            }
            return;
        }
        int ry = y;
        for (StatusEffectInstance e : list) {
            if (background.value) ctx.fill(x, ry, x + getWidth(mc), ry + 20, BG);
            Sprite sprite = mc.getStatusEffectSpriteManager().getSprite(e.getEffectType());
            if (showIcons.value) ctx.drawSprite(x + 2, ry + 1, 0, 18, 18, sprite);
            String name = e.getEffectType().value().getName().getString();
            if (e.getAmplifier() > 0) name += " " + roman(e.getAmplifier() + 1);
            String time = e.isInfinite() ? "**:**" : StringHelper.formatTicks(e.getDuration(), mc.world != null ? mc.world.getTickManager().getTickRate() : 20f);
            ctx.drawTextWithShadow(mc.textRenderer, name, x + (showIcons.value ? 22 : 4), ry + 2, textColor.color(ry));
            ctx.drawTextWithShadow(mc.textRenderer, time, x + (showIcons.value ? 22 : 4), ry + 11, 0xFFB9A8FF);
            ry += 20;
        }
    }

    private static String roman(int n) {
        return switch (n) { case 2 -> "II"; case 3 -> "III"; case 4 -> "IV"; case 5 -> "V"; default -> String.valueOf(n); };
    }
}
