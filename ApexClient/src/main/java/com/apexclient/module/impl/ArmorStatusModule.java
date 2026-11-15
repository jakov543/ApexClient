package com.apexclient.module.impl;

import com.apexclient.module.HudModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;

/** Armor + held item with durability. */
public class ArmorStatusModule extends HudModule {

    private static final EquipmentSlot[] SLOTS = {
            EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET, EquipmentSlot.MAINHAND };

    public final com.apexclient.module.Setting.Bool showDurability = add(new com.apexclient.module.Setting.Bool("Show durability", true));
    public final com.apexclient.module.Setting.Bool showHeld = add(new com.apexclient.module.Setting.Bool("Show held item", true));

    public ArmorStatusModule() { super("Armor Status", "Armor and held item durability", true, 4, 200); }

    @Override
    public int getWidth(MinecraftClient mc) { return 60; }

    @Override
    public int getHeight(MinecraftClient mc) { return (showHeld.value ? SLOTS.length : SLOTS.length - 1) * 17 + 2; }

    @Override
    public void draw(DrawContext ctx, MinecraftClient mc, int x, int y, boolean preview) {
        ItemStack[] stacks = new ItemStack[SLOTS.length];
        for (int i = 0; i < SLOTS.length; i++) {
            stacks[i] = mc.player != null ? mc.player.getEquippedStack(SLOTS[i]) : ItemStack.EMPTY;
        }
        if (preview && allEmpty(stacks)) {
            stacks = new ItemStack[]{ new ItemStack(Items.DIAMOND_HELMET), new ItemStack(Items.DIAMOND_CHESTPLATE),
                    new ItemStack(Items.DIAMOND_LEGGINGS), new ItemStack(Items.DIAMOND_BOOTS), new ItemStack(Items.DIAMOND_SWORD) };
        }
        int ry = y + 1;
        int count = showHeld.value ? stacks.length : stacks.length - 1;
        if (background.value) ctx.fill(x - 2, y - 1, x + getWidth(mc), y + getHeight(mc), BG);
        for (int i = 0; i < count; i++) {
            ItemStack s = stacks[i];
            if (!s.isEmpty()) {
                ctx.drawItem(s, x, ry);
                ctx.drawItemInSlot(mc.textRenderer, s, x, ry);
                String txt = s.isDamageable() ? String.valueOf(s.getMaxDamage() - s.getDamage()) : (s.getCount() > 1 ? "x" + s.getCount() : "");
                int color = 0xFFFFFFFF;
                if (s.isDamageable()) {
                    float pct = 1f - (float) s.getDamage() / s.getMaxDamage();
                    color = pct > 0.5f ? 0xFF7CFF8A : pct > 0.2f ? 0xFFFFD25C : 0xFFFF5C5C;
                }
                if (showDurability.value) ctx.drawTextWithShadow(mc.textRenderer, txt, x + 19, ry + 4, color == 0xFFFFFFFF ? textColor.color(ry) : color);
            }
            ry += 17;
        }
    }

    private static boolean allEmpty(ItemStack[] s) {
        for (ItemStack i : s) if (!i.isEmpty()) return false;
        return true;
    }
}
