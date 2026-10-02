package com.naavi.util;

public final class Enums {
    private Enums() {}

    /** Case/space/hyphen-insensitive enum parse. Returns null for null/unknown input. */
    public static <E extends Enum<E>> E parse(Class<E> type, String raw) {
        if (raw == null) return null;
        String s = raw.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        if (s.isEmpty()) return null;
        for (E e : type.getEnumConstants()) if (e.name().equals(s)) return e;
        return null;
    }

    public static <E extends Enum<E>> String options(Class<E> type) {
        StringBuilder sb = new StringBuilder();
        for (E e : type.getEnumConstants()) {
            if (sb.length() > 0) sb.append(" | ");
            sb.append(e.name());
        }
        return sb.toString();
    }
}
