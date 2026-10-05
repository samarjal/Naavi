package com.naavi.tools;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.naavi.tools.GeoService.Place;
import org.junit.jupiter.api.Test;

class GeoServiceTest {
    private static final String TWO_GOAS = """
        {"results":[
          {"name":"Goa","country_code":"PH","latitude":13.7,"longitude":123.5,"feature_code":"PPL"},
          {"name":"Goa","admin1":"Goa","country_code":"IN","latitude":15.3,"longitude":74.0,"feature_code":"ADM1"}]}""";

    @Test
    void prefersIndianMatch_and_cachesResult() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 200, TWO_GOAS)) {
            GeoService geo = new GeoService(new ObjectMapper(), m.url());
            Place p = geo.locate("Goa").orElseThrow();
            assertEquals("IN", p.countryCode());
            assertTrue(p.isRegion());
            geo.locate("goa");
            assertEquals(1, m.hits.get(), "second lookup should come from the cache");
        }
    }

    @Test
    void failuresReturnEmpty() throws Exception {
        try (MockServer m = new MockServer().respond("/v1/search", 500, "{}")) {
            GeoService geo = new GeoService(new ObjectMapper(), m.url());
            assertTrue(geo.locate("Goa").isEmpty());
            assertTrue(geo.locate("  ").isEmpty());
            assertTrue(geo.locate(null).isEmpty());
        }
        GeoService unreachable = new GeoService(new ObjectMapper(), "http://127.0.0.1:1");
        assertTrue(unreachable.locate("Goa").isEmpty());
    }

    @Test
    void haversine_delhi_to_goa_is_about_1500km() {
        double km = GeoService.haversineKm(28.6139, 77.2090, 15.4909, 73.8278);
        assertTrue(km > 1400 && km < 1600, "was " + km);
    }
}
