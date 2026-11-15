package com.apexclient.module.impl;

import com.apexclient.module.Module;
import com.apexclient.module.Setting;

/** Hold the Zoom key (C) to zoom. Handled in GameRendererMixin; scroll while zooming to change it. */
public class ZoomModule extends Module {
    public final Setting.Slider fov = add(new Setting.Slider("Zoom FOV", 2, 50, 1, 15, "°"));
    public final Setting.Bool smooth = add(new Setting.Bool("Smooth zoom", true));
    public final Setting.Bool scroll = add(new Setting.Bool("Scroll to adjust", true));

    public ZoomModule() { super("Zoom", "Hold C to zoom, scroll to adjust", Category.PVP, true); }
}
