package com.apexclient.module;

import com.apexclient.ApexClient;
import com.apexclient.ApexConfig;
import com.apexclient.gui.HudEditorScreen;
import com.apexclient.module.impl.*;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * Holds every module, draws the HUD, and saves state in profiles:
 * config/apexclient/profiles/&lt;name&gt;.json (on/off, positions and every option).
 */
public final class ModuleManager {

    private static final List<Module> MODULES = new ArrayList<>();
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static String profile = "Default";

    private ModuleManager() {}

    public static void init() {
        // HUD
        MODULES.add(new FpsModule());
        MODULES.add(new CpsModule());
        MODULES.add(new KeystrokesModule());
        MODULES.add(new CoordinatesModule());
        MODULES.add(new PingModule());
        MODULES.add(new ArmorStatusModule());
        MODULES.add(new PotionEffectsModule());
        MODULES.add(new ClockModule());
        MODULES.add(new ServerAddressModule());
        // PvP / utility
        MODULES.add(new ZoomModule());
        MODULES.add(new ToggleSprintModule());
        // Visual
        MODULES.add(new FullbrightModule());
        // Cosmetic
        MODULES.add(new CapeModule());

        migrateOldConfig();
        try {
            String saved = Files.exists(currentFile()) ? Files.readString(currentFile()).trim() : "";
            if (!saved.isEmpty() && Files.exists(profileFile(saved))) profile = saved;
        } catch (Exception ignored) {}
        load(profile);
    }

    public static List<Module> all() { return MODULES; }

    public static List<HudModule> hud() {
        List<HudModule> list = new ArrayList<>();
        for (Module m : MODULES) if (m instanceof HudModule h) list.add(h);
        return list;
    }

    @SuppressWarnings("unchecked")
    public static <T extends Module> T get(Class<T> type) {
        for (Module m : MODULES) if (type.isInstance(m)) return (T) m;
        throw new IllegalArgumentException(type.getName());
    }

    public static void tick(MinecraftClient mc) {
        for (Module m : MODULES) if (m.isEnabled()) m.onTick(mc);
    }

    public static void renderHud(DrawContext ctx, RenderTickCounter tick) {
        MinecraftClient mc = MinecraftClient.getInstance();
        if (mc.player == null || mc.options.hudHidden) return;
        if (mc.getDebugHud().shouldShowDebugHud() && !ApexConfig.hudInDebug) return;
        if (mc.currentScreen instanceof HudEditorScreen) return; // the editor draws them itself
        int sw = ctx.getScaledWindowWidth(), sh = ctx.getScaledWindowHeight();
        for (HudModule h : hud()) {
            if (!h.isEnabled()) continue;
            h.clamp(sw, sh, mc);
            h.renderScaled(ctx, mc, false);
        }
    }

    // ------------------------------------------------------------------ profiles

    private static Path dir() { return FabricLoader.getInstance().getConfigDir().resolve("apexclient"); }
    private static Path profilesDir() { return dir().resolve("profiles"); }
    private static Path currentFile() { return dir().resolve("profile.txt"); }
    private static Path profileFile(String name) { return profilesDir().resolve(safe(name) + ".json"); }
    private static String safe(String name) { return name.replaceAll("[^A-Za-z0-9 _-]", "").trim(); }

    public static String currentProfile() { return profile; }

    public static List<String> profiles() {
        List<String> out = new ArrayList<>();
        try {
            Files.createDirectories(profilesDir());
            try (Stream<Path> s = Files.list(profilesDir())) {
                s.filter(p -> p.toString().endsWith(".json")).sorted().forEach(p -> {
                    String n = p.getFileName().toString();
                    out.add(n.substring(0, n.length() - 5));
                });
            }
        } catch (Exception ignored) {}
        if (!out.contains("Default")) out.add(0, "Default");
        else { out.remove("Default"); out.add(0, "Default"); }
        return out;
    }

    public static void switchProfile(String name) {
        if (name.equals(profile)) return;
        save();
        boolean fullbrightWas = get(FullbrightModule.class).isEnabled();
        profile = name;
        load(name);
        FullbrightModule fb = get(FullbrightModule.class);
        if (fb.isEnabled()) fb.apply(); else if (fullbrightWas) fb.restore();
        saveCurrentName();
    }

    /** Saves the current setup as a new profile and switches to it. Returns the name used. */
    public static String createProfile() {
        List<String> existing = profiles();
        int n = existing.size();
        String name;
        do { name = "Profile " + n++; } while (existing.contains(name));
        profile = name;
        save();
        saveCurrentName();
        return name;
    }

    public static void deleteProfile(String name) {
        if (name.equals("Default")) return;
        try { Files.deleteIfExists(profileFile(name)); } catch (Exception ignored) {}
        if (name.equals(profile)) { profile = "Default"; load(profile); saveCurrentName(); }
    }

    private static void saveCurrentName() {
        try {
            Files.createDirectories(dir());
            Files.writeString(currentFile(), profile);
        } catch (Exception ignored) {}
    }

    // ------------------------------------------------------------------ save / load

    public static void save() {
        JsonObject root = new JsonObject();
        for (Module m : MODULES) {
            JsonObject o = new JsonObject();
            o.addProperty("enabled", m.isEnabled());
            if (m instanceof HudModule h) {
                o.addProperty("x", h.x);
                o.addProperty("y", h.y);
            }
            JsonObject set = new JsonObject();
            for (Setting s : m.getSettings()) set.add(s.name, s.save());
            o.add("settings", set);
            root.add(m.getId(), o);
        }
        try {
            Files.createDirectories(profilesDir());
            try (Writer w = Files.newBufferedWriter(profileFile(profile))) { GSON.toJson(root, w); }
            saveCurrentName();
        } catch (Exception e) {
            ApexClient.LOG.warn("Could not save profile " + profile, e);
        }
    }

    private static void load(String name) {
        Path f = profileFile(name);
        if (!Files.exists(f)) { save(); return; }
        try (Reader r = Files.newBufferedReader(f)) {
            JsonObject root = GSON.fromJson(r, JsonObject.class);
            for (Module m : MODULES) {
                if (root == null) break;
                JsonObject o = root.has(m.getId()) ? root.getAsJsonObject(m.getId())
                        : root.has(m.getName()) ? root.getAsJsonObject(m.getName()) : null; // old saves used the name
                if (o == null) continue;
                if (o.has("enabled")) m.loadEnabled(o.get("enabled").getAsBoolean());
                if (m instanceof HudModule h) {
                    if (o.has("x")) h.x = o.get("x").getAsInt();
                    if (o.has("y")) h.y = o.get("y").getAsInt();
                }
                if (o.has("settings")) {
                    JsonObject set = o.getAsJsonObject("settings");
                    for (Setting s : m.getSettings()) if (set.has(s.name)) s.load(set.get(s.name));
                }
            }
        } catch (Exception e) {
            ApexClient.LOG.warn("Could not load profile " + name, e);
        }
    }

    /** v1.0–1.2 saved everything in config/apexclient-modules.json → becomes the Default profile. */
    private static void migrateOldConfig() {
        try {
            Path old = FabricLoader.getInstance().getConfigDir().resolve("apexclient-modules.json");
            if (Files.exists(old) && !Files.exists(profileFile("Default"))) {
                Files.createDirectories(profilesDir());
                Files.move(old, profileFile("Default"));
            }
        } catch (Exception e) {
            ApexClient.LOG.warn("Could not migrate old module config", e);
        }
    }
}
