package com.naavi.service;

import com.naavi.entity.Trip;
import com.naavi.service.PreferenceResolver.EffectivePreferences;
import com.naavi.tools.AccommodationTool;
import com.naavi.tools.BudgetSplitter;
import com.naavi.tools.BudgetSplitter.Split;
import com.naavi.tools.ToolExecutor;
import com.naavi.tools.TransportTool;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Runs the transport and accommodation tools in parallel and returns their results for the AI context.
 *
 * A tool that fails or times out is reported as NOT_AVAILABLE; the planner then falls back to estimates for
 * that part, so one slow external service never fails the whole plan.
 */
@Component
@Primary
public class LiveTravelDataProvider implements TravelDataProvider {
    private static final Logger log = LoggerFactory.getLogger(LiveTravelDataProvider.class);
    private static final int TOOL_TIMEOUT_SECONDS = 15;

    private static final Map<String, Object> NO_PLACES = Map.of("status", "NOT_AVAILABLE",
            "note", "No attractions provider is configured. Use well-known real places and label them ESTIMATED.");

    private final TransportTool transportTool;
    private final AccommodationTool accommodationTool;

    public LiveTravelDataProvider(TransportTool transportTool, AccommodationTool accommodationTool) {
        this.transportTool = transportTool;
        this.accommodationTool = accommodationTool;
    }

    @Override
    public Map<String, Object> fetch(Trip trip, EffectivePreferences prefs) {
        int travelers = trip.getTravelers() == null ? 1 : Math.max(1, trip.getTravelers());
        int days = trip.getDays() == null ? 3 : Math.max(1, trip.getDays());

        Split split = null;
        if (trip.getBudget() != null && trip.getBudget().signum() > 0) {
            split = BudgetSplitter.of(trip.getBudget(), travelers, days);
        }
        final Split sp = split;
        String transportPref = prefs == null ? null : prefs.values().get("transportationPreference");
        String stayPref = prefs == null ? null : prefs.values().get("accommodationPreference");

        CompletableFuture<Map<String, Object>> transport = CompletableFuture.supplyAsync(
                () -> transportTool.search(trip.getSource(), trip.getDestination(), travelers,
                        sp == null ? null : sp.transportCapPerPersonRoundTrip(), transportPref), ToolExecutor.EXEC);
        CompletableFuture<Map<String, Object>> stays = CompletableFuture.supplyAsync(
                () -> accommodationTool.search(trip.getDestination(), sp == null ? null : sp.hotelCapPerRoomNight(),
                        travelers, BudgetSplitter.roomsFor(travelers), Math.max(1, days - 1), stayPref), ToolExecutor.EXEC);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("travelData", await(transport, "transport"));
        out.put("hotelData", await(stays, "accommodation"));
        out.put("placeData", NO_PLACES);
        if (sp != null) out.put("budgetGuide", sp.toMap());
        return out;
    }

    private static Map<String, Object> await(CompletableFuture<Map<String, Object>> f, String tool) {
        try {
            return f.get(TOOL_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return failed(tool);
        } catch (Exception e) {
            log.warn("{} tool failed: {}", tool, e.toString());
            f.cancel(true);
            return failed(tool);
        }
    }

    private static Map<String, Object> failed(String tool) {
        return Map.of("status", "NOT_AVAILABLE",
                "note", "The " + tool + " lookup didn't respond. Use realistic Indian market estimates and label them ESTIMATED.");
    }
}
