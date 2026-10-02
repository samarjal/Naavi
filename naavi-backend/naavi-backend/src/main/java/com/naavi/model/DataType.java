package com.naavi.model;

/** Provenance of a number shown to the user. */
public enum DataType {
    LIVE, ESTIMATED, USER_PROVIDED;

    public static DataType from(String raw) {
        if (raw == null) return ESTIMATED;
        String s = raw.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        for (DataType d : values()) if (d.name().equals(s)) return d;
        return ESTIMATED;
    }
}
