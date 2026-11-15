package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.PlayerListEntry;

public class PingModule extends TextHudModule {
    public final com.apexclient.module.Setting.Bool colorByPing = add(new com.apexclient.module.Setting.Bool("Colour by ping", true));

    public PingModule() { super("Ping", "Your latency to the server", true, 4, 58); }

    private int latency(MinecraftClient mc) {
        if (mc.player == null || mc.getNetworkHandler() == null || mc.isInSingleplayer()) return 0;
        PlayerListEntry e = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid());
        return e == null ? 0 : e.getLatency();
    }

    @Override
    protected int valueColor(MinecraftClient mc, boolean preview) {
        if (!colorByPing.value) return 0;
        int ms = preview && latency(mc) == 0 ? 45 : latency(mc);
        return ms < 80 ? 0xFF4FF0A8 : ms < 150 ? 0xFFFFD25C : 0xFFFF5C5C;
    }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        if (mc.player == null || mc.getNetworkHandler() == null) return "0 ms";
        if (mc.isInSingleplayer()) return "0 ms";
        PlayerListEntry e = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid());
        return (e == null ? 0 : e.getLatency()) + " ms";
    }
}
