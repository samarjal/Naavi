package com.naavi.service;

import com.naavi.entity.Trip;
import com.naavi.tools.BudgetSplitter;
import com.naavi.tools.GeoService;
import com.naavi.tools.GeoService.Place;
import com.naavi.tools.TransportTool;
import com.naavi.util.Money;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Deterministic "is this budget even possible?" gate. Runs BEFORE any LLM call.
 *
 * It computes the absolute minimum a trip can cost (cheapest intercity fare, cheapest shared room, basic food and
 * local rides) and compares it with the user's budget. If the budget is below that floor, the planner stops and
 * returns an honest, practical reply instead of letting the LLM invent a plan that "fits".
 *
 * The floor is deliberately a LOWER bound: it never rejects a budget that could plausibly work.
 */
@Component
public class BudgetFeasibilityChecker {
    // Tune these in one place. Rupees, per the cheapest realistic option in India.
    static final long FOOD_PER_PERSON_PER_DAY = 250;       // simple vegetarian thali / dhaba meals
    static final long LOCAL_PER_PERSON_PER_DAY = 60;       // shared jeeps, autos, short buses
    static final long ROOM_PER_NIGHT_FLOOR = 600;          // cheapest shared / dorm-style room
    static final long FALLBACK_INTERCITY_RT_PER_PERSON = 300; // used only when the route can't be geocoded
    private static final BigDecimal COMFORT_MARGIN = new BigDecimal("1.15"); // suggested budget = floor + 15%
    private static final long ROUND_TO = 500;

    private final GeoService geo;
    private final TransportTool transport;

    public BudgetFeasibilityChecker(GeoService geo, TransportTool transport) {
        this.geo = geo;
        this.transport = transport;
    }

    public record Floor(BigDecimal transport, BigDecimal stay, BigDecimal food, BigDecimal local) {
        public BigDecimal total() { return transport.add(stay).add(food).add(local); }
    }

    public record Verdict(boolean feasible, Floor floor, BigDecimal minimumTotal, BigDecimal suggestedBudget,
                          int maxAffordableDays, boolean perPersonReadingWorks, String reply) {
        static Verdict ok(Floor f) {
            return new Verdict(true, f, f.total(), f.total(), 0, false, null);
        }
    }

    /** Cheap, side-effect-free (one geocode call, cached by GeoService). */
    public Verdict check(Trip trip) {
        BigDecimal budget = trip.getBudget();
        if (budget == null || budget.signum() <= 0) return Verdict.ok(zero());
        int travelers = Math.max(1, trip.getTravelers() == null ? 1 : trip.getTravelers());
        int days = Math.max(1, trip.getDays() == null ? 3 : trip.getDays());

        long rtPerPerson = cheapestRoundTripPerPerson(trip.getSource(), trip.getDestination(), travelers);
        Floor floor = floor(rtPerPerson, travelers, days);
        if (budget.compareTo(floor.total()) >= 0) return Verdict.ok(floor);

        BigDecimal suggested = roundUp(floor.total().multiply(COMFORT_MARGIN));
        int maxDays = maxAffordableDays(rtPerPerson, travelers, days, budget);
        boolean perPerson = budget.multiply(BigDecimal.valueOf(travelers)).compareTo(floor.total()) >= 0;
        String reply = buildReply(trip, budget, travelers, days, floor, suggested, maxDays, perPerson);
        return new Verdict(false, floor, floor.total(), suggested, maxDays, perPerson, reply);
    }

    // ------------------------------------------------------------------ pure maths (unit-tested)

    static Floor floor(long roundTripPerPerson, int travelers, int days) {
        int nights = Math.max(1, days - 1);
        int rooms = BudgetSplitter.roomsFor(travelers);
        return new Floor(
                BigDecimal.valueOf(roundTripPerPerson).multiply(BigDecimal.valueOf(travelers)),
                BigDecimal.valueOf(ROOM_PER_NIGHT_FLOOR).multiply(BigDecimal.valueOf((long) nights * rooms)),
                BigDecimal.valueOf(FOOD_PER_PERSON_PER_DAY).multiply(BigDecimal.valueOf((long) travelers * days)),
                BigDecimal.valueOf(LOCAL_PER_PERSON_PER_DAY).multiply(BigDecimal.valueOf((long) travelers * days)));
    }

    /** Longest trip (fewer than requested days) whose floor fits the budget; 0 if even a 1-day trip does not. */
    static int maxAffordableDays(long rtPerPerson, int travelers, int requestedDays, BigDecimal budget) {
        for (int d = requestedDays - 1; d >= 1; d--) {
            if (budget.compareTo(floor(rtPerPerson, travelers, d).total()) >= 0) return d;
        }
        return 0;
    }

    static BigDecimal roundUp(BigDecimal v) {
        return v.divide(BigDecimal.valueOf(ROUND_TO), 0, RoundingMode.CEILING).multiply(BigDecimal.valueOf(ROUND_TO));
    }

    static String buildReply(Trip trip, BigDecimal budget, int travelers, int days, Floor f,
                             BigDecimal suggested, int maxDays, boolean perPerson) {
        BigDecimal min = f.total();
        BigDecimal minPerPerson = min.divide(BigDecimal.valueOf(travelers), 0, RoundingMode.CEILING);
        String who = travelers == 1 ? "1 traveller" : travelers + " travellers";
        StringBuilder sb = new StringBuilder();
        sb.append("I can't make a realistic plan for ").append(Money.inr(budget)).append(": a ").append(days)
                .append("-day trip from ").append(trip.getSource()).append(" to ").append(trip.getDestination())
                .append(" for ").append(who).append(" costs more than that, even done as cheaply as possible.\n\n");
        sb.append("The bare minimum is about ").append(Money.inr(min)).append(" (~").append(Money.inr(minPerPerson))
                .append(" per person):\n")
                .append("- Travel (cheapest train/bus, return): ").append(Money.inr(f.transport())).append('\n')
                .append("- Stay (basic shared room): ").append(Money.inr(f.stay())).append('\n')
                .append("- Food (simple meals): ").append(Money.inr(f.food())).append('\n')
                .append("- Local rides: ").append(Money.inr(f.local())).append("\n\n");
        sb.append("Here's what you can do:\n");
        sb.append("- Raise the budget to around ").append(Money.inr(suggested)).append(" and I'll plan it with a small buffer.\n");
        if (maxDays >= 1) {
            sb.append("- Keep ").append(Money.inr(budget)).append(" and shorten the trip to ").append(maxDays)
                    .append(maxDays == 1 ? " day" : " days").append(".\n");
        } else {
            sb.append("- Pick a closer destination: even a 1-day trip to ").append(trip.getDestination())
                    .append(" doesn't fit this budget. Tell me a nearby place and I'll check.\n");
        }
        if (perPerson) {
            sb.append("- If ").append(Money.inr(budget)).append(" is per person, that's ")
                    .append(Money.inr(budget.multiply(BigDecimal.valueOf(travelers))))
                    .append(" in total, which works. Just confirm and I'll plan it.\n");
        }
        sb.append("\nPrices are estimates; remote hill routes usually cost more than this minimum.");
        return sb.toString();
    }

    // ------------------------------------------------------------------ route lookup

    private long cheapestRoundTripPerPerson(String source, String destination, int travelers) {
        try {
            Optional<Place> a = geo.locate(source);
            Optional<Place> b = geo.locate(destination);
            if (a.isPresent() && b.isPresent()) {
                double km = GeoService.haversineKm(a.get(), b.get());
                if (km < 30) return 0; // same area: no intercity travel needed
                return transport.estimate(km, travelers, null, "CHEAPEST").stream()
                        .map(TransportTool.Option::roundTripPerPerson)
                        .min(Comparator.naturalOrder()).orElse(FALLBACK_INTERCITY_RT_PER_PERSON);
            }
        } catch (RuntimeException ignored) {
            // fall through to the conservative fallback
        }
        return FALLBACK_INTERCITY_RT_PER_PERSON;
    }

    private static Floor zero() {
        return new Floor(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }
}