package com.naavi.model;

public enum PlanType {
    BUDGET(1.0), COMFORT(1.2), PREMIUM(1.5);

    private final double multiplier;

    PlanType(double multiplier) { this.multiplier = multiplier; }

    public double multiplier() { return multiplier; }

    public static PlanType from(String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase();
        for (PlanType p : values()) if (p.name().equals(s)) return p;
        return null;
    }
}
