package com.naavi.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.ai.ItineraryGenerator.GeneratedPlan;
import com.naavi.entity.Expense;
import com.naavi.entity.Itinerary;
import com.naavi.entity.Trip;
import com.naavi.repository.ExpenseRepository;
import com.naavi.repository.ItineraryRepository;
import com.naavi.service.BudgetEngine.ExpenseLine;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ItineraryService {
    private final ItineraryRepository itineraries;
    private final ExpenseRepository expenses;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public Optional<Itinerary> latest(Long tripId) {
        return itineraries.findTopByTripIdOrderByVersionDesc(tripId);
    }

    public JsonNode readPlan(Itinerary it) {
        try {
            return mapper.readTree(it.getPlanJson());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored itinerary " + it.getId() + " is corrupt", e);
        }
    }

    public int nextVersion(Long tripId) {
        return latest(tripId).map(i -> i.getVersion() + 1).orElse(1);
    }

    @Transactional
    public Itinerary save(Trip trip, GeneratedPlan plan) {
        ObjectNode json = plan.json();
        Itinerary it = new Itinerary();
        it.setTripId(trip.getId());
        it.setVersion(json.path("version").asInt(nextVersion(trip.getId())));
        it.setUserBudget(trip.getBudget());
        it.setTotalEstimatedCost(plan.primaryTotal());
        try {
            it.setPlanJson(mapper.writeValueAsString(json));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialise itinerary", e);
        }
        Itinerary saved = itineraries.save(it);

        List<Expense> rows = new ArrayList<>();
        for (Map.Entry<com.naavi.model.PlanType, List<ExpenseLine>> e : plan.expenseLines().entrySet()) {
            for (ExpenseLine l : e.getValue()) {
                Expense x = new Expense();
                x.setItineraryId(saved.getId());
                x.setPlanType(e.getKey());
                x.setCategory(l.category());
                x.setDescription(l.description());
                x.setUnitCost(l.unitCost());
                x.setQuantity(l.quantity());
                x.setAmount(l.amount());
                x.setDataType(l.dataType());
                rows.add(x);
            }
        }
        expenses.saveAll(rows);
        return saved;
    }

    /** Trimmed view of a stored plan, used as context for modification prompts and Q&A. */
    public ObjectNode compact(JsonNode plan) {
        ObjectNode out = mapper.createObjectNode();
        for (String k : List.of("tripSummary", "transportation", "accommodation", "days")) {
            if (plan.has(k)) out.set(k, plan.get(k));
        }
        JsonNode ex = plan.path("expenses");
        if (ex.isObject()) {
            ObjectNode e = mapper.createObjectNode();
            e.set("byCategory", ex.path("byCategory"));
            e.set("total", ex.path("total"));
            e.set("budget", ex.path("budget"));
            out.set("expenses", e);
        }
        return out;
    }
}
