package com.apexclient.gui;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.tooltip.Tooltip;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

/** See-through Lunar-style button: wide text buttons, an accent variant, and square icon buttons. */
public class ApexButton extends ButtonWidget {

    public enum Style { NORMAL, ACCENT, ICON }

    private final Style style;
    private final Identifier icon;

    public ApexButton(int x, int y, int w, int h, String label, Style style, PressAction onPress) {
        super(x, y, w, h, Text.literal(label), onPress, DEFAULT_NARRATION_SUPPLIER);
        this.style = style;
        this.icon = null;
    }

    /** Square icon button with a hover tooltip. */
    public ApexButton(int x, int y, int size, Identifier icon, String tooltip, PressAction onPress) {
        super(x, y, size, size, Text.literal(tooltip), onPress, DEFAULT_NARRATION_SUPPLIER);
        this.style = Style.ICON;
        this.icon = icon;
        setTooltip(Tooltip.of(Text.literal(tooltip)));
    }

    @Override
    protected void renderWidget(DrawContext ctx, int mouseX, int mouseY, float delta) {
        int x = getX(), y = getY(), w = getWidth(), h = getHeight();
        boolean hot = isHovered() || isFocused();
        MinecraftClient mc = MinecraftClient.getInstance();

        switch (style) {
            case ACCENT -> {
                int a = hot ? 0xF0 : 0xC0;
                ctx.fillGradient(x, y, x + w, y + h, (a << 24) | 0xD24BFF, (a << 24) | 0x7C5CFF);
                Ui.border(ctx, x, y, w, h, hot ? 0xCCFFFFFF : 0x66FFB0F0);
            }
            case ICON -> Ui.box(ctx, x, y, w, h, hot ? 0x70FFFFFF : 0x38FFFFFF, hot ? 0xAAFFFFFF : 0x55FFFFFF);
            default -> Ui.box(ctx, x, y, w, h, hot ? Ui.BUTTON_HOVER : Ui.BUTTON, hot ? 0xBBFFFFFF : 0x60FFFFFF);
        }

        if (style == Style.ICON && icon != null) {
            int s = Math.min(w, h) - 8;
            Ui.texture(ctx, icon, x + (w - s) / 2, y + (h - s) / 2, s, s, active ? 0xFFFFFFFF : 0x80FFFFFF);
        } else {
            String label = getMessage().getString().toUpperCase();
            Ui.spaced(ctx, mc.textRenderer, label, x + w / 2, y + (h - 8) / 2 + 1, active ? 0xFFFFFFFF : 0xFF9A93B5, 2);
        }
    }
}
