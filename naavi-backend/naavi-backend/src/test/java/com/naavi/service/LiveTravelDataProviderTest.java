package com.naavi.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.naavi.entity.Trip;
import com.naavi.service.PreferenceResolver.EffectivePreferences;
import com.naavi.tools.AccommodationTool;
import com.naavi.tools.GeoService;
import com.naavi.tools.TransportTool;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** "Plan a trip to Goa for 3 days, 3 people, budget 30000" - run through the provider with mocked HTTP. */
class LiveTravelDataProviderTest {
    private static final String OVERPASS = """
        {"elements":[
          {"type":"node","lat":15.541,"lon":73.761,"tags":{"name":"Sea Breeze Guest House","tourism":"guest_house"}},
          {"type":"node","lat":15.543,"lon":73.762,"tags":{"name":"Hotel Mid Town","tourism":"hotel","stars":"3"}}]}""";

    private static HttpServer server() throws IOException {
        HttpServer s = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        s.createContext("/v1/search", ex -> {
            boolean delhi = ex.getRequestURI().getQuery().contains("Delhi");
            String body = "{\"results\":[{\"name\":\"" + (delhi ? "Delhi" : "Goa") + "\",\"country_code\":\"IN\",\"latitude\":"
                    + (delhi ? "28.6139" : "15.4909") + ",\"longitude\":" + (delhi ? "77.2090" : "73.8278")
                    + ",\"feature_code\":\"PPL\"}]}";
            byte[] b = body.getBytes();
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        s.createContext("/api", ex -> {
            byte[] b = OVERPASS.getBytes();
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
            ex.close();
        });
        s.start();
        return s;
    }

    private static Trip goaTrip() {
        Trip t = new Trip();
        t.setSource("Delhi");
        t.setDestination("Goa");
        t.setBudget(new BigDecimal("30000"));
        t.setTravelers(3);
        t.setDays(3);
        return t;
    }

    @SuppressWarnings("unchecked")
    @Test
    void goaExample_returnsTransportStaysAndBudgetGuide() throws Exception {
        HttpServer s = server();
        try {
            String base = "http://127.0.0.1:" + s.getAddress().getPort();
            ObjectMapper om = new ObjectMapper();
            GeoService geo = new GeoService(om, base);
            LiveTravelDataProvider p = new LiveTravelDataProvider(new TransportTool(geo),
                    new AccommodationTool(om, geo, base + "/api"));
            EffectivePreferences prefs = new EffectivePreferences(
                    Map.of("transportationPreference", "NO_PREFERENCE", "accommodationPreference", "NO_PREFERENCE"), Map.of(), Map.of());

            Map<String, Object> out = p.fetch(goaTrip(), prefs);

            assertEquals("ESTIMATED", ((Map<String, Object>) out.get("travelData")).get("status"));
            assertEquals("LISTINGS_AVAILABLE", ((Map<String, Object>) out.get("hotelData")).get("status"));
            assertEquals("NOT_AVAILABLE", ((Map<String, Object>) out.get("placeData")).get("status"));
            Map<String, Object> guide = (Map<String, Object>) out.get("budgetGuide");
            assertEquals(new BigDecimal("4500"), guide.get("hotelCapPerRoomNight"));
            assertEquals(new BigDecimal("3500"), guide.get("transportCapPerPersonRoundTrip"));
            // the whole context must serialise to JSON for the LLM
            String json = om.writeValueAsString(out);
            assertTrue(json.contains("Hotel Mid Town") && json.contains("\"mode\":\"TRAIN\""));
        } finally {
            s.stop(0);
        }
    }

    @SuppressWarnings("unchecked")
    @Test
    void toolOutage_degradesToNotAvailable_insteadOfFailing() {
        ObjectMapper om = new ObjectMapper();
        GeoService geo = new GeoService(om, "http://127.0.0.1:1");
        LiveTravelDataProvider p = new LiveTravelDataProvider(new TransportTool(geo),
                new AccommodationTool(om, geo, "http://127.0.0.1:1/api"));
        Map<String, Object> out = p.fetch(goaTrip(), null);
        assertEquals("NOT_AVAILABLE", ((Map<String, Object>) out.get("travelData")).get("status"));
        assertEquals("NOT_AVAILABLE", ((Map<String, Object>) out.get("hotelData")).get("status"));
        assertNotNull(out.get("budgetGuide"), "budget guide needs no network");
    }

    @Test
    void noBudget_stillWorks_withoutCaps() throws Exception {
        HttpServer s = server();
        try {
            String base = "http://127.0.0.1:" + s.getAddress().getPort();
            ObjectMapper om = new ObjectMapper();
            GeoService geo = new GeoService(om, base);
            LiveTravelDataProvider p = new LiveTravelDataProvider(new TransportTool(geo), new AccommodationTool(om, geo, base + "/api"));
            Trip t = goaTrip();
            t.setBudget(null);
            Map<String, Object> out = p.fetch(t, null);
            assertFalse(out.containsKey("budgetGuide"));
            assertEquals("ESTIMATED", ((Map<?, ?>) out.get("travelData")).get("status"));
        } finally {
            s.stop(0);
        }
    }
}
