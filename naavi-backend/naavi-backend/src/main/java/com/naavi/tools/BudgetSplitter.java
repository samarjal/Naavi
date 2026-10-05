package com.naavi.tools;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Turns the user's total budget into per-tool caps. Plain arithmetic, no LLM.
 *
 * Suggested split: transport 35%, stay 30%, food + local travel 25%, buffer 10%.
 * These are guides used to filter tool results (e.g. "hotels under X per night"), not hard limits;
 * the real totals are still computed by BudgetEngine from the final plan.
 */
public final class BudgetSplitter {
    public static final BigDecimal TRANSPORT = new BigDecimal("0.35");
    public static final BigDecimal STAY = new BigDecimal("0.30");
    public static final BigDecimal FOOD_AND_LOCAL = new BigDecimal("0.25");
    public static final BigDecimal BUFFER = new BigDecimal("0.10");

    private BudgetSplitter() {}

    public record Split(BigDecimal budget, int travelers, int days, int nights, int rooms,
                        BigDecimal transportTotal, BigDecimal stayTotal, BigDecimal foodAndLocalTotal,
                        BigDecimal buffer, BigDecimal transportCapPerPersonRoundTrip,
                        BigDecimal hotelCapPerRoomNight, BigDecimal foodAndLocalPerPersonPerDay) {

        public Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("currency", "INR");
            m.put("totalBudget", budget);
            m.put("travelers", travelers);
            m.put("days", days);
            m.put("nights", nights);
            m.put("rooms", rooms);
            m.put("transportTotal", transportTotal);
            m.put("stayTotal", stayTotal);
            m.put("foodAndLocalTotal", foodAndLocalTotal);
            m.put("buffer", buffer);
            m.put("transportCapPerPersonRoundTrip", transportCapPerPersonRoundTrip);
            m.put("hotelCapPerRoomNight", hotelCapPerRoomNight);
            m.put("foodAndLocalPerPersonPerDay", foodAndLocalPerPersonPerDay);
            m.put("note", "Guide only. Prefer options under these caps; if nothing fits, pick the cheapest and say so.");
            return m;
        }
    }

    /** 1-3 travellers share one room; larger groups are booked two per room. */
    public static int roomsFor(int travelers) {
        int t = Math.max(1, travelers);
        return t <= 3 ? 1 : (int) Math.ceil(t / 2.0);
    }

    public static Split of(BigDecimal budget, int travelers, int days) {
        if (budget == null || budget.signum() <= 0) throw new IllegalArgumentException("budget must be positive");
        int t = Math.max(1, travelers);
        int d = Math.max(1, days);
        int nights = Math.max(1, d - 1);
        int rooms = roomsFor(t);

        BigDecimal transport = share(budget, TRANSPORT);
        BigDecimal stay = share(budget, STAY);
        BigDecimal food = share(budget, FOOD_AND_LOCAL);
        BigDecimal buffer = share(budget, BUFFER);

        return new Split(budget, t, d, nights, rooms, transport, stay, food, buffer,
                div(transport, t), div(stay, (long) nights * rooms), div(food, (long) t * d));
    }

    private static BigDecimal share(BigDecimal total, BigDecimal pct) {
        return total.multiply(pct).setScale(0, RoundingMode.HALF_UP);
    }

    private static BigDecimal div(BigDecimal a, long b) {
        return a.divide(BigDecimal.valueOf(b), 0, RoundingMode.HALF_UP);
    }
}
