package com.apexclient.module;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

/** One option of a module (shown in its OPTIONS screen and saved in the profile). */
public abstract class Setting {

    public final String name;
    private Runnable onChange = () -> {};

    protected Setting(String name) {
        this.name = name;
    }

    public Setting onChange(Runnable r) {
        this.onChange = r;
        return this;
    }

    protected void changed() {
        onChange.run();
    }

    public abstract JsonElement save();
    public abstract void load(JsonElement e);
    public abstract void reset();

    // ------------------------------------------------------------------ on / off
    public static class Bool extends Setting {
        public boolean value;
        private final boolean def;

        public Bool(String name, boolean def) {
            super(name);
            this.def = def;
            this.value = def;
        }

        public void toggle() { value = !value; changed(); }
        public void set(boolean v) { value = v; changed(); }

        @Override public JsonElement save() { return new JsonPrimitive(value); }
        @Override public void load(JsonElement e) { if (e != null && e.isJsonPrimitive()) value = e.getAsBoolean(); }
        @Override public void reset() { value = def; changed(); }
    }

    // ------------------------------------------------------------------ number slider
    public static class Slider extends Setting {
        public double value;
        public final double min, max, step;
        private final double def;
        private final String suffix;

        public Slider(String name, double min, double max, double step, double def, String suffix) {
            super(name);
            this.min = min;
            this.max = max;
            this.step = step;
            this.def = def;
            this.value = def;
            this.suffix = suffix;
        }

        /** @param t 0..1 position on the slider */
        public void setFraction(double t) { set(min + (max - min) * Math.max(0, Math.min(1, t))); }

        public void set(double v) {
            v = Math.round(v / step) * step;
            value = Math.max(min, Math.min(max, v));
            changed();
        }

        public double fraction() { return (value - min) / (max - min); }

        public String display() {
            String num = step >= 1 ? String.valueOf((int) Math.round(value)) : String.format("%.2f", value);
            return num + suffix;
        }

        @Override public JsonElement save() { return new JsonPrimitive(value); }
        @Override public void load(JsonElement e) { if (e != null && e.isJsonPrimitive()) value = Math.max(min, Math.min(max, e.getAsDouble())); }
        @Override public void reset() { value = def; changed(); }
    }

    // ------------------------------------------------------------------ pick one of a list
    public static class Choice extends Setting {
        public int index;
        public final String[] names;
        private final int def;

        public Choice(String name, int def, String... names) {
            super(name);
            this.names = names;
            this.def = def;
            this.index = def;
        }

        public void next() { index = (index + 1) % names.length; changed(); }
        public void prev() { index = (index - 1 + names.length) % names.length; changed(); }
        public String display() { return names[index]; }

        @Override public JsonElement save() { return new JsonPrimitive(index); }
        @Override public void load(JsonElement e) { if (e != null && e.isJsonPrimitive()) index = Math.max(0, Math.min(names.length - 1, e.getAsInt())); }
        @Override public void reset() { index = def; changed(); }
    }

    // ------------------------------------------------------------------ text colour (with chroma)
    public static class Colour extends Choice {
        private static final String[] NAMES = {"White", "Purple", "Cyan", "Pink", "Green", "Yellow", "Red", "Chroma"};
        private static final int[] COLORS = {0xFFFFFFFF, 0xFFB9A8FF, 0xFF2EE6FF, 0xFFFF6FE0, 0xFF4FF0A8, 0xFFFFD25C, 0xFFFF5C5C, 0};

        public Colour(String name, int def) {
            super(name, def, NAMES);
        }

        /** @param offset shifts the rainbow so neighbouring letters/elements differ */
        public int color(int offset) {
            if (index != NAMES.length - 1) return COLORS[index];
            float hue = ((System.currentTimeMillis() + offset * 12L) % 4000L) / 4000f;
            return 0xFF000000 | (java.awt.Color.HSBtoRGB(hue, 0.55f, 1f) & 0xFFFFFF);
        }

        public int color() { return color(0); }
    }
}
