package com.naavi.tools;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.naavi.tools.AccommodationTool.Option;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AccommodationToolTest {
    private static final String GEO = """
        {"results":[{"name":"Calangute","admin1":"Goa","country_code":"IN","latitude":15.54,"longitude":73.76,"feature_code":"PPL"}]}""";

    private static final String OVERPASS = """
        {"elements":[
          {"type":"node","lat":15.541,"lon":73.761,"tags":{"name":"Sea Breeze Guest House","tourism":"guest_house","addr:suburb":"Calangute"}},
          {"type":"way","center":{"lat":15.545,"lon":73.765},"tags":{"name":"Taj Fort Aguada Resort","tourism":"hotel","stars":"5","website":"http://x","phone":"1"}},
          {"type":"node","lat":15.542,"lon":73.760,"tags":{"name":"Zostel Goa","tourism":"hostel","website":"http://z"}},
          {"type":"node","lat":15.543,"lon":73.762,"tags":{"name":"Hotel Mid Town","tourism":"hotel","stars":"3","addr:city":"Calangute"}},
          {"type":"node","lat":15.543,"lon":73.762,"tags":{"name":"hotel mid town","tourism":"hotel"}},
          {"type":"node","lat":15.540,"lon":73.760,"tags":{"tourism":"hotel"}},
          {"type":"way","tags":{"name":"No Coordinates Inn","tourism":"hotel"}}
        ]}""";

    private AccommodationTool tool(MockServer geoServer, String overpassCsv) {
        ObjectMapper om = new ObjectMapper();
        return new AccommodationTool(om, new GeoService(om, geoServer.url()), overpassCsv);
    }

    @SuppressWarnings("unchecked")
    private static List<Option> options(Map<String, Object> r) {
        return (List<Option>) r.get("options");
    }

    @Test
    void parsesRealListings_dropsJunk_andFlagsBudget() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, GEO).respond("/api", 200, OVERPASS)) {
            Map<String, Object> r = tool(m, m.url() + "/api").search("Calangute", new BigDecimal("4500"), 3, 1, 2, null);
            assertEquals("LISTINGS_AVAILABLE", r.get("status"));
            List<Option> o = options(r);
            // unnamed, coordinate-less and duplicate entries are dropped: 4 distinct usable stays remain
            assertEquals(4, o.size());
            assertTrue(o.stream().noneMatch(x -> x.name().equals("No Coordinates Inn")));
            Option resort = o.stream().filter(x -> x.name().startsWith("Taj")).findFirst().orElseThrow();
            assertEquals("RESORT", resort.category());
            assertFalse(resort.fitsNightlyBudget(), "a 5-star resort must not fit a 4,500 nightly cap");
            Option mid = o.stream().filter(x -> x.name().equals("Hotel Mid Town")).findFirst().orElseThrow();
            assertTrue(mid.fitsNightlyBudget());
            assertEquals(3200L * 1 * 2, mid.estimatedStayTotal());
            assertTrue(o.stream().allMatch(x -> x.dataType().equals("ESTIMATED") && x.nameSource().equals("OpenStreetMap")));
            // affordable stays are ranked above the one that blows the cap
            assertEquals("Taj Fort Aguada Resort", o.get(o.size() - 1).name());
            assertTrue(o.get(0).bestMatch());
        }
    }

    @Test
    void hostelIsPricedPerBedTimesGuests() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, GEO).respond("/api", 200, OVERPASS)) {
            Option hostel = options(tool(m, m.url() + "/api").search("Calangute", null, 3, 1, 2, null)).stream()
                    .filter(x -> x.category().equals("HOSTEL")).findFirst().orElseThrow();
            assertEquals(800L * 3, hostel.estimatedPricePerRoomNight());
            assertNull(hostel.fitsNightlyBudget(), "no cap -> no verdict");
        }
    }

    @Test
    void preferenceBoostsMatchingTier() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, GEO).respond("/api", 200, OVERPASS)) {
            List<Option> o = options(tool(m, m.url() + "/api").search("Calangute", null, 2, 1, 2, "PREMIUM_X"));
            assertTrue(o.stream().allMatch(Option::matchesPreference), "unknown preference must not exclude anything");
            List<Option> res = options(tool(m, m.url() + "/api").search("Calangute", null, 2, 1, 2, "RESORT"));
            assertEquals("Taj Fort Aguada Resort", res.get(0).name());
            assertTrue(res.get(0).matchesPreference());
        }
    }

    @Test
    void fallsBackToSecondEndpoint_whenFirstFails() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, GEO)
                .respond("/bad", 504, "busy").respond("/good", 200, OVERPASS)) {
            Map<String, Object> r = tool(m, m.url() + "/bad," + m.url() + "/good").search("Calangute", null, 2, 1, 2, null);
            assertEquals("LISTINGS_AVAILABLE", r.get("status"));
        }
    }

    @Test
    void cachesResultsPerArea() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, GEO)) {
            MockServer o = new MockServer().respond("/api", 200, OVERPASS);
            try (o) {
                AccommodationTool t = tool(m, o.url() + "/api");
                t.search("Calangute", null, 2, 1, 2, null);
                t.search("Calangute", null, 4, 2, 3, "BUDGET");
                assertEquals(1, o.hits.get());
            }
        }
    }

    @Test
    void unavailableWhenNothingFoundOrEverythingFails() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, GEO).respond("/empty", 200, "{\"elements\":[]}")) {
            assertEquals("NOT_AVAILABLE", tool(m, m.url() + "/empty").search("Calangute", null, 2, 1, 2, null).get("status"));
            assertEquals("NOT_AVAILABLE", tool(m, "http://127.0.0.1:1/x").search("Calangute", null, 2, 1, 2, null).get("status"));
        }
        try (MockServer m = new MockServer().respond("/v1/search", 200, "{}")) {
            assertEquals("NOT_AVAILABLE", tool(m, m.url() + "/x").search("Atlantis", null, 2, 1, 2, null).get("status"));
        }
    }
}
