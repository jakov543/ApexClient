package com.apexclient.module;

import net.minecraft.client.MinecraftClient;

/** A feature that can be switched on/off in the Right Shift mod menu. */
public abstract class Module {

    public enum Category { HUD, PVP, VISUAL, COSMETIC }

    private final String name;
    private final String description;
    private final Category category;
    private boolean enabled;

    protected Module(String name, String description, Category category, boolean enabledByDefault) {
        this.name = name;
        this.description = description;
        this.category = category;
        this.enabled = enabledByDefault;
    }

    public String getName() { return name; }
    public String getDescription() { return description; }
    public Category getCategory() { return category; }
    public boolean isEnabled() { return enabled; }

    public void setEnabled(boolean value) {
        if (value == enabled) return;
        enabled = value;
        if (value) onEnable(); else onDisable();
    }

    public void toggle() { setEnabled(!enabled); }

    /** Sets the saved state at startup without firing enable/disable events. */
    void loadEnabled(boolean value) { enabled = value; }

    protected void onEnable() {}
    protected void onDisable() {}
    public void onTick(MinecraftClient mc) {}
}
