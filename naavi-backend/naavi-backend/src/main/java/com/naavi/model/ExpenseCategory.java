package com.naavi.model;

public enum ExpenseCategory {
    TRANSPORTATION, ACCOMMODATION, FOOD, LOCAL_TRANSPORT, ACTIVITIES, MISCELLANEOUS;

    /** Lenient mapping from whatever label the LLM used. Returns null when nothing matches. */
    public static ExpenseCategory from(String raw) {
        if (raw == null) return null;
        String s = raw.toUpperCase().replaceAll("[^A-Z]", "");
        if (s.isEmpty()) return null;
        if (s.contains("LOCAL") || s.contains("INTRACITY") || s.contains("CITYTRANSPORT")) return LOCAL_TRANSPORT;
        if (s.contains("TRANSPORT") || s.contains("INTERCITY") || s.contains("TRAVEL")) return TRANSPORTATION;
        if (s.contains("ACCOM") || s.contains("HOTEL") || s.contains("STAY") || s.contains("LODG")) return ACCOMMODATION;
        if (s.contains("FOOD") || s.contains("MEAL") || s.contains("DINING")) return FOOD;
        if (s.contains("ACTIVIT") || s.contains("ENTRY") || s.contains("SIGHT") || s.contains("EXPERIENCE")) return ACTIVITIES;
        if (s.contains("MISC") || s.contains("OTHER") || s.contains("PARKING") || s.contains("SHOPPING")
                || s.contains("BUFFER")) return MISCELLANEOUS;
        return null;
    }
}
