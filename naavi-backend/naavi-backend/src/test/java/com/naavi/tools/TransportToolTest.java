package com.naavi.tools;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.naavi.tools.TransportTool.Option;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class TransportToolTest {
    private final TransportTool tool = new TransportTool(null);
    private static final BigDecimal CAP = new BigDecimal("3500"); // round trip per person for the Goa example

    private static Option recommended(List<Option> l) {
        List<Option> r = l.stream().filter(Option::recommended).toList();
        assertEquals(1, r.size(), "exactly one option must be recommended");
        return r.get(0);
    }

    private static Option find(List<Option> l, String mode, String cls) {
        return l.stream().filter(o -> o.mode().equals(mode) && o.travelClass().equals(cls)).findFirst().orElseThrow();
    }

    @Test
    void longRoute_underTightBudget_recommendsSleeperTrain() {
        List<Option> o = tool.estimate(1500, 3, CAP, null);
        Option rec = recommended(o);
        assertEquals("TRAIN", rec.mode());
        assertEquals("SL", rec.travelClass());
        assertTrue(Boolean.TRUE.equals(rec.fitsBudget()));
        assertFalse(find(o, "FLIGHT", "ECONOMY").fitsBudget());
        assertFalse(find(o, "TRAIN", "2A").fitsBudget());
        // no cab on a ~1950 km road trip, and plausible price levels
        assertTrue(o.stream().noneMatch(x -> x.mode().equals("CAB")));
        assertTrue(rec.costPerPersonOneWay() > 700 && rec.costPerPersonOneWay() < 1200, "SL was " + rec.costPerPersonOneWay());
        long flight = find(o, "FLIGHT", "ECONOMY").costPerPersonOneWay();
        assertTrue(flight > 4000 && flight < 8000, "flight was " + flight);
    }

    @Test
    void groupTotalIsPerPersonTimesTravellersTimesTwoLegs() {
        Option sl = find(tool.estimate(1500, 3, null, null), "TRAIN", "SL");
        assertEquals(sl.costPerPersonOneWay() * 2, sl.roundTripPerPerson());
        assertEquals(sl.roundTripPerPerson() * 3, sl.roundTripForGroup());
        assertNull(sl.fitsBudget(), "no cap given -> no budget verdict");
    }

    @Test
    void preferences_changeTheRecommendation() {
        assertEquals("FLIGHT", recommended(tool.estimate(1500, 2, null, "FASTEST")).mode());
        assertEquals("TRAIN", recommended(tool.estimate(1500, 2, null, "CHEAPEST")).mode());
        assertEquals("FLIGHT", recommended(tool.estimate(1500, 2, null, "FLIGHT_PREFERRED")).mode());
        assertEquals("BUS", recommended(tool.estimate(500, 2, null, "BUS_PREFERRED")).mode());
        Option comfy = recommended(tool.estimate(1500, 2, null, "COMFORTABLE"));
        assertTrue(comfy.mode().equals("FLIGHT") || comfy.travelClass().equals("2A"), "was " + comfy.label());
    }

    @Test
    void shortRoute_hasCabAndBus_butNoFlight() {
        List<Option> o = tool.estimate(230, 5, null, null);
        assertTrue(o.stream().anyMatch(x -> x.mode().equals("CAB") && x.label().contains("2 vehicles")));
        assertTrue(o.stream().anyMatch(x -> x.mode().equals("BUS")));
        assertTrue(o.stream().noneMatch(x -> x.mode().equals("FLIGHT")));
    }

    @Test
    void nothingFitsBudget_stillRecommendsCheapest() {
        List<Option> o = tool.estimate(1500, 3, new BigDecimal("100"), null);
        assertTrue(o.stream().noneMatch(x -> Boolean.TRUE.equals(x.fitsBudget())));
        Option rec = recommended(o);
        assertEquals(o.stream().mapToLong(Option::roundTripPerPerson).min().orElseThrow(), rec.roundTripPerPerson());
    }

    @Test
    void everyOptionIsLabelledEstimated_andRecommendedComesFirst() {
        List<Option> o = tool.estimate(800, 2, null, null);
        assertTrue(o.stream().allMatch(x -> x.dataType().equals("ESTIMATED")));
        assertTrue(o.get(0).recommended());
    }

    private static final String GEO = """
        {"results":[{"name":"%s","country_code":"%s","latitude":%s,"longitude":%s,"feature_code":"PPL"}]}""";

    @Test
    void search_geocodesBothEnds_and_reportsRoute() throws Exception {
        try (MockServer m = new MockServer()) {
            m.server.createContext("/v1/search", ex -> {
                String q = ex.getRequestURI().getQuery();
                String body = q.contains("Delhi") ? GEO.formatted("Delhi", "IN", "28.6139", "77.2090")
                        : GEO.formatted("Goa", "IN", "15.4909", "73.8278");
                byte[] b = body.getBytes();
                ex.sendResponseHeaders(200, b.length);
                ex.getResponseBody().write(b);
                ex.close();
            });
            TransportTool t = new TransportTool(new GeoService(new ObjectMapper(), m.url()));
            Map<String, Object> r = t.search("Delhi", "Goa", 3, CAP, null);
            assertEquals("ESTIMATED", r.get("status"));
            assertEquals(Boolean.TRUE, r.get("anyOptionFitsBudget"));
            @SuppressWarnings("unchecked") Map<String, Object> route = (Map<String, Object>) r.get("route");
            assertEquals("Delhi", route.get("from"));
            assertTrue(((Number) route.get("straightLineKm")).longValue() > 1400);
        }
    }

    @Test
    void search_nonIndianOrUnknownRoutes_areNotAvailable() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, GEO.formatted("Paris", "FR", "48.85", "2.35"))) {
            TransportTool t = new TransportTool(new GeoService(new ObjectMapper(), m.url()));
            assertEquals("NOT_AVAILABLE", t.search("Paris", "Paris", 2, null, null).get("status"));
        }
        try (MockServer m = new MockServer().respond("/v1/search", 200, "{}")) {
            TransportTool t = new TransportTool(new GeoService(new ObjectMapper(), m.url()));
            assertEquals("NOT_AVAILABLE", t.search("Nowhere", "Goa", 2, null, null).get("status"));
        }
    }
}
