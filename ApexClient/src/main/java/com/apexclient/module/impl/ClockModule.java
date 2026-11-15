package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class ClockModule extends TextHudModule {
    private static final DateTimeFormatter FMT24 = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter FMT12 = DateTimeFormatter.ofPattern("h:mm a");
    public final com.apexclient.module.Setting.Bool h24 = add(new com.apexclient.module.Setting.Bool("24-hour clock", true));

    public ClockModule() { super("Clock", "Real-life time", false, 4, 76); }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        return LocalTime.now().format(h24.value ? FMT24 : FMT12);
    }
}
