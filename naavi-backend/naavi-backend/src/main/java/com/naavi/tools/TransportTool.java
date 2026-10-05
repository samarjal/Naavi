package com.naavi.tools;

import com.naavi.tools.GeoService.Place;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Tool: get_transport_options(source, destination, travelers, budget cap, preference).
 *
 * India has no open public API for train / bus fares (IRCTC and the bus aggregators are closed), so this tool
 * is a distance-based fare model, and every option is labelled ESTIMATED. What the tool does guarantee is
 * consistency: real distance from geocoding, the same fare rules every time, the group total, and a budget
 * check. The fare table below is the one place to tune; a live provider can replace estimate() later.
 */
@Component
public class TransportTool {
    private static final double RAIL_FACTOR = 1.25;   // rail distance vs straight line
    private static final double ROAD_FACTOR = 1.30;   // road distance vs straight line
    private static final double VALUE_OF_TIME_PER_HOUR = 200; // used to rank options when no preference is set

    private final GeoService geo;

    public TransportTool(GeoService geo) {
        this.geo = geo;
    }

    public record Option(String mode, String travelClass, String label, double durationHours,
                         long costPerPersonOneWay, long roundTripPerPerson, long roundTripForGroup,
                         String fareNote, Boolean fitsBudget, boolean recommended, String dataType, String notes) {}

    public Map<String, Object> search(String source, String destination, int travelers,
                                      BigDecimal capPerPersonRoundTrip, String preference) {
        Optional<Place> from = geo.locate(source);
        Optional<Place> to = geo.locate(destination);
        if (from.isEmpty() || to.isEmpty()) {
            return unavailable("Couldn't locate " + (from.isEmpty() ? "'" + source + "'" : "'" + destination + "'")
                    + ", so transport options couldn't be calculated.");
        }
        Place a = from.get();
        Place b = to.get();
        if (!"IN".equalsIgnoreCase(a.countryCode()) || !"IN".equalsIgnoreCase(b.countryCode())) {
            return unavailable("The fare model only covers routes within India.");
        }
        double straight = GeoService.haversineKm(a, b);
        if (straight < 30) {
            return unavailable("Source and destination are in the same area; no intercity transport is needed.");
        }

        List<Option> options = estimate(straight, travelers, capPerPersonRoundTrip, preference);
        boolean anyFits = options.stream().anyMatch(o -> Boolean.TRUE.equals(o.fitsBudget()));

        Map<String, Object> route = new LinkedHashMap<>();
        route.put("from", a.name());
        route.put("to", b.name());
        route.put("straightLineKm", Math.round(straight));
        route.put("approxRoadKm", Math.round(straight * ROAD_FACTOR));
        route.put("approxRailKm", Math.round(straight * RAIL_FACTOR));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", options.isEmpty() ? "NOT_AVAILABLE" : "ESTIMATED");
        out.put("dataType", "ESTIMATED");
        out.put("source", "Naavi distance-based fare model (no live fare provider connected)");
        out.put("route", route);
        out.put("travelers", Math.max(1, travelers));
        out.put("transportCapPerPersonRoundTrip", capPerPersonRoundTrip);
        out.put("anyOptionFitsBudget", capPerPersonRoundTrip == null ? null : anyFits);
        out.put("options", options);
        out.put("note", "Fares are model estimates, not live prices. Train names, numbers and timings are not part of this "
                + "data. costPerPersonOneWay is per person for one direction; plan ONWARD and RETURN legs separately.");
        return out;
    }

    /** Pure, deterministic fare model. {@code straightKm} is the great-circle distance. */
    public List<Option> estimate(double straightKm, int travelers, BigDecimal cap, String preference) {
        int t = Math.max(1, travelers);
        double rail = straightKm * RAIL_FACTOR;
        double road = straightKm * ROAD_FACTOR;
        List<Option> raw = new ArrayList<>();

        if (straightKm >= 60) {
            double hours = rail / 58.0 + 0.5;
            raw.add(build("TRAIN", "SL", "Train (Sleeper)", hours, Math.max(120, 60 + 0.45 * rail), t, cap,
                    "Cheapest rail class; non-AC, can be crowded on long routes."));
            if (rail <= 650) {
                raw.add(build("TRAIN", "CC", "Train (AC Chair Car)", hours, Math.max(200, 80 + 0.85 * rail), t, cap,
                        "Comfortable day option on short and medium routes."));
            }
            raw.add(build("TRAIN", "3A", "Train (AC 3-Tier)", hours, Math.max(300, 100 + 1.15 * rail), t, cap,
                    "AC sleeper berths, good for overnight journeys."));
            raw.add(build("TRAIN", "2A", "Train (AC 2-Tier)", hours, Math.max(450, 150 + 1.65 * rail), t, cap,
                    "More space and privacy than 3A."));
        }
        if (road >= 60 && road <= 1200) {
            double hours = road / 45.0 + 0.5;
            raw.add(build("BUS", "AC_SEATER", "Bus (AC seater / Volvo)", hours, Math.max(150, 80 + 2.0 * road), t, cap,
                    "Frequent departures; fares swing with season and operator."));
            raw.add(build("BUS", "AC_SLEEPER", "Bus (AC sleeper)", hours, Math.max(200, 100 + 2.5 * road), t, cap,
                    "Overnight option that saves a hotel night on long routes."));
        }
        if (straightKm >= 350) {
            double hours = straightKm / 650.0 + 0.75 + 3.0; // flight time + airport transfers/check-in
            raw.add(build("FLIGHT", "ECONOMY", "Flight (economy)", hours, 1800 + 2.3 * straightKm, t, cap,
                    "Duration includes about 3 hours for airport transfers and check-in. Fares rise sharply close to the date."));
        }
        if (road <= 900) {
            int cabs = (int) Math.ceil(t / 4.0);
            double perVehicle = Math.max(1500, road * 11);
            double perPerson = perVehicle * cabs / t;
            raw.add(build("CAB", "SEDAN_OR_SUV", "Private cab (" + cabs + (cabs == 1 ? " vehicle" : " vehicles") + ")",
                    road / 50.0 + 0.5, perPerson, t, cap,
                    "Door-to-door and flexible; the group total is split across travellers. Return trips are usually billed both ways."));
        }
        return rank(raw, preference, cap);
    }

    private static Option build(String mode, String cls, String label, double hours, double fareOneWay, int t,
                                BigDecimal cap, String notes) {
        long one = round10(fareOneWay);
        long roundTrip = one * 2;
        Boolean fits = cap == null ? null : BigDecimal.valueOf(roundTrip).compareTo(cap) <= 0;
        String band = "approx " + inr(round10(fareOneWay * 0.85)) + " - " + inr(round10(fareOneWay * 1.15)) + " per person one way";
        return new Option(mode, cls, label, Math.round(hours * 10) / 10.0, one, roundTrip, roundTrip * t,
                band, fits, false, "ESTIMATED", notes);
    }

    // ------------------------------------------------------------------ ranking

    private static List<Option> rank(List<Option> options, String preference, BigDecimal cap) {
        if (options.isEmpty()) return options;
        List<Option> fitting = options.stream().filter(o -> !Boolean.FALSE.equals(o.fitsBudget())).toList();
        List<Option> pool = fitting.isEmpty() ? options : fitting;
        String pref = preference == null ? "" : preference.toUpperCase(Locale.ROOT);

        Option best = switch (pref) {
            case "CHEAPEST" -> min(pool, Comparator.comparingLong(Option::roundTripPerPerson));
            case "FASTEST" -> min(pool, Comparator.comparingDouble(Option::durationHours));
            case "COMFORTABLE" -> min(pool, Comparator.comparingInt((Option o) -> -comfort(o))
                    .thenComparingLong(Option::roundTripPerPerson));
            case "TRAIN_PREFERRED" -> preferMode(pool, "TRAIN");
            case "BUS_PREFERRED" -> preferMode(pool, "BUS");
            case "FLIGHT_PREFERRED" -> preferMode(pool, "FLIGHT");
            default -> min(pool, Comparator.comparingDouble(
                    o -> o.roundTripPerPerson() + 2 * o.durationHours() * VALUE_OF_TIME_PER_HOUR));
        };
        if (fitting.isEmpty()) { // nothing fits the budget: recommend the cheapest and let the caller warn
            best = min(options, Comparator.comparingLong(Option::roundTripPerPerson));
        }

        final Option chosen = best;
        List<Option> out = new ArrayList<>();
        for (Option o : options) {
            out.add(new Option(o.mode(), o.travelClass(), o.label(), o.durationHours(), o.costPerPersonOneWay(),
                    o.roundTripPerPerson(), o.roundTripForGroup(), o.fareNote(), o.fitsBudget(),
                    o == chosen, o.dataType(), o.notes()));
        }
        out.sort(Comparator.comparing((Option o) -> !o.recommended()).thenComparingLong(Option::roundTripPerPerson));
        return out;
    }

    private static Option preferMode(List<Option> pool, String mode) {
        List<Option> of = pool.stream().filter(o -> o.mode().equals(mode)).toList();
        if (of.isEmpty()) {
            return min(pool, Comparator.comparingDouble(
                    o -> o.roundTripPerPerson() + 2 * o.durationHours() * VALUE_OF_TIME_PER_HOUR));
        }
        return min(of, Comparator.comparingLong(Option::roundTripPerPerson));
    }

    private static int comfort(Option o) {
        return switch (o.mode()) {
            case "FLIGHT" -> 4;
            case "CAB" -> 4;
            case "TRAIN" -> switch (o.travelClass()) { case "2A" -> 4; case "3A", "CC" -> 3; default -> 1; };
            case "BUS" -> 2;
            default -> 0;
        };
    }

    private static Option min(List<Option> l, Comparator<Option> c) {
        return l.stream().min(c).orElseThrow();
    }

    private static long round10(double v) {
        return Math.round(v / 10.0) * 10;
    }

    private static String inr(long v) {
        return "Rs " + String.format(Locale.ROOT, "%,d", v);
    }

    private static Map<String, Object> unavailable(String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "NOT_AVAILABLE");
        m.put("note", note + " Use realistic Indian market estimates and label them ESTIMATED.");
        return m;
    }
}
