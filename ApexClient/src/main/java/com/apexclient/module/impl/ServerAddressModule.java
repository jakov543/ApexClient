package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;

public class ServerAddressModule extends TextHudModule {
    public ServerAddressModule() { super("Server IP", "Shows the server you are on", false, 4, 94); }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        if (mc.isInSingleplayer()) return "Singleplayer";
        if (mc.getCurrentServerEntry() == null) return "play.server.net";
        return mc.getCurrentServerEntry().address;
    }
}
