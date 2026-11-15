package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.PlayerListEntry;

public class PingModule extends TextHudModule {
    public PingModule() { super("Ping", "Your latency to the server", true, 4, 58); }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        if (mc.player == null || mc.getNetworkHandler() == null) return "0 ms";
        if (mc.isInSingleplayer()) return "0 ms";
        PlayerListEntry e = mc.getNetworkHandler().getPlayerListEntry(mc.player.getUuid());
        return (e == null ? 0 : e.getLatency()) + " ms";
    }
}
