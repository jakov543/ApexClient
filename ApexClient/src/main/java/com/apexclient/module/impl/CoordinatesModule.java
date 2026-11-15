package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;

public class CoordinatesModule extends TextHudModule {
    public final com.apexclient.module.Setting.Bool showDir = add(new com.apexclient.module.Setting.Bool("Show direction", true));

    public CoordinatesModule() { super("Coordinates", "Your X Y Z and facing direction", true, 4, 40); }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        if (mc.player == null) return "X 0  Y 64  Z 0  (N)";
        String dir = switch (mc.player.getHorizontalFacing()) {
            case NORTH -> "N"; case SOUTH -> "S"; case EAST -> "E"; case WEST -> "W"; default -> "?";
        };
        String xyz = String.format("X %d  Y %d  Z %d", mc.player.getBlockX(), mc.player.getBlockY(), mc.player.getBlockZ());
        return showDir.value ? xyz + "  (" + dir + ")" : xyz;
    }
}
