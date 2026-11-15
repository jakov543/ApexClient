package com.apexclient;

import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/** Settings stored in .minecraft/config/apexclient.properties (created on first launch). */
public final class ApexConfig {

    // Put YOUR Discord Application ID here (or in the config file) — see README.
    public static final String DEFAULT_CLIENT_ID = "000000000000000000";

    public static String discordClientId = DEFAULT_CLIENT_ID;
    public static boolean discordEnabled = true;
    public static String discordLargeImage = "logo";
    public static boolean showServerAddress = true;
    public static String buttonLabel = "Join our Discord";
    public static String buttonUrl = "";
    public static boolean customMainMenu = true;

    private static Path file() {
        return FabricLoader.getInstance().getConfigDir().resolve("apexclient.properties");
    }

    public static void load() {
        Properties p = new Properties();
        Path f = file();
        if (Files.exists(f)) {
            try (Reader r = Files.newBufferedReader(f)) { p.load(r); }
            catch (IOException e) { ApexClient.LOG.warn("Could not read config", e); }
        }
        discordClientId = p.getProperty("discord.clientId", discordClientId).trim();
        discordEnabled = bool(p, "discord.enabled", discordEnabled);
        discordLargeImage = p.getProperty("discord.largeImage", discordLargeImage).trim();
        showServerAddress = bool(p, "discord.showServerAddress", showServerAddress);
        buttonLabel = p.getProperty("discord.buttonLabel", buttonLabel);
        buttonUrl = p.getProperty("discord.buttonUrl", buttonUrl).trim();
        customMainMenu = bool(p, "client.customMainMenu", customMainMenu);
        save();
    }

    public static void save() {
        Properties p = new Properties();
        p.setProperty("discord.clientId", discordClientId);
        p.setProperty("discord.enabled", String.valueOf(discordEnabled));
        p.setProperty("discord.largeImage", discordLargeImage);
        p.setProperty("discord.showServerAddress", String.valueOf(showServerAddress));
        p.setProperty("discord.buttonLabel", buttonLabel);
        p.setProperty("discord.buttonUrl", buttonUrl);
        p.setProperty("client.customMainMenu", String.valueOf(customMainMenu));
        try (Writer w = Files.newBufferedWriter(file())) {
            p.store(w, "Apex Client settings");
        } catch (IOException e) {
            ApexClient.LOG.warn("Could not save config", e);
        }
    }

    private static boolean bool(Properties p, String key, boolean def) {
        return Boolean.parseBoolean(p.getProperty(key, String.valueOf(def)));
    }
}
