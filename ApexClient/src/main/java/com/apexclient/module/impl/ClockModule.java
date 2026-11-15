package com.apexclient.module.impl;

import com.apexclient.module.TextHudModule;
import net.minecraft.client.MinecraftClient;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;

public class ClockModule extends TextHudModule {
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("HH:mm");

    public ClockModule() { super("Clock", "Real-life time", false, 4, 76); }

    @Override
    protected String getText(MinecraftClient mc, boolean preview) {
        return LocalTime.now().format(FMT);
    }
}
