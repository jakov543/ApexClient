package com.apexclient.module;

import com.apexclient.ApexClient;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.Identifier;

import java.util.ArrayList;
import java.util.List;

/** A feature that can be switched on/off in the Right Shift mod menu. */
public abstract class Module {

    public enum Category {
        HUD("HUD"), PVP("PVP"), VISUAL("VISUAL"), COSMETIC("COSMETIC");
        public final String label;
        Category(String label) { this.label = label; }
    }

    private final String name;
    private final String description;
    private final Category category;
    private final boolean enabledByDefault;
    private boolean enabled;
    private final List<Setting> settings = new ArrayList<>();
    private final Identifier icon;

    protected Module(String name, String description, Category category, boolean enabledByDefault) {
        this.name = name;
        this.description = description;
        this.category = category;
        this.enabledByDefault = enabledByDefault;
        this.enabled = enabledByDefault;
        this.icon = Identifier.of(ApexClient.MOD_ID, "textures/icons/" + getId() + ".png");
    }

    public String getName() { return name; }
    public String getDescription() { return description; }
    public Category getCategory() { return category; }
    public boolean isEnabled() { return enabled; }
    public Identifier getIcon() { return icon; }
    public List<Setting> getSettings() { return settings; }

    /** e.g. "Armor Status" → "armor_status" (icon file + save key) */
    public String getId() { return name.toLowerCase().replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", ""); }

    protected <S extends Setting> S add(S setting) {
        settings.add(setting);
        return setting;
    }

    public void setEnabled(boolean value) {
        if (value == enabled) return;
        enabled = value;
        if (value) onEnable(); else onDisable();
    }

    public void toggle() { setEnabled(!enabled); }

    /** Restores default on/off state and every option. */
    public void resetToDefaults() {
        for (Setting s : settings) s.reset();
        setEnabled(enabledByDefault);
    }

    /** Sets the saved state when a profile loads, without firing enable/disable events. */
    void loadEnabled(boolean value) { enabled = value; }

    protected void onEnable() {}
    protected void onDisable() {}
    public void onTick(MinecraftClient mc) {}
}
