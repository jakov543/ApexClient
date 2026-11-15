package com.apexclient.module.impl;

import com.apexclient.ApexClient;
import com.apexclient.module.Module;
import net.minecraft.util.Identifier;

/** Apex cape on your own player (visible to you, like a client cosmetic). Applied in PlayerCapeMixin. */
public class CapeModule extends Module {
    public static final Identifier CAPE = Identifier.of(ApexClient.MOD_ID, "textures/cape/apex_cape.png");

    public CapeModule() { super("Apex Cape", "Wear the Apex Client cape", Category.COSMETIC, true); }
}
