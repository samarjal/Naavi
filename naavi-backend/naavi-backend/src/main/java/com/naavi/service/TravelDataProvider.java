package com.naavi.service;

import com.naavi.entity.Trip;
import com.naavi.service.PreferenceResolver.EffectivePreferences;
import java.util.Map;

/**
 * Extension point for live hotel / transport / attraction data (e.g. Amadeus, RapidAPI, Google Places).
 * Return maps shaped like {"status":"LIVE","options":[...]} and they flow straight into the AI context.
 * Until a real provider is wired in, the default implementation reports nothing is live, and the
 * planner marks every price as ESTIMATED.
 */
public interface TravelDataProvider {
    /** Keys: "travelData", "hotelData", "placeData", and optionally "budgetGuide". */
    Map<String, Object> fetch(Trip trip, EffectivePreferences prefs);
}
