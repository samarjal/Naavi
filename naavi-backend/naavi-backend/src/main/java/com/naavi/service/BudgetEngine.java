package com.naavi.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.model.DataType;
import com.naavi.model.ExpenseCategory;
import com.naavi.util.Money;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * All money arithmetic lives here. The LLM only supplies unitCost and quantity per line item;
 * amounts, category totals, remaining budget and buffer are computed by the backend.
 */
@Component
@RequiredArgsConstructor
public class BudgetEngine {
    private static final BigDecimal MAX_UNIT_COST = new BigDecimal("1000000");
    private static final BigDecimal BUFFER_FULL = new BigDecimal("0.10");
    private static final BigDecimal BUFFER_MIN = new BigDecimal("0.05");

    private final ObjectMapper mapper;

    public record ExpenseLine(ExpenseCategory category, String description, BigDecimal unitCost,
                              BigDecimal quantity, BigDecimal amount, DataType dataType) {}

    public record Summary(List<ExpenseLine> lines, Map<ExpenseCategory, BigDecimal> byCategory, BigDecimal total,
                          BigDecimal budget, BigDecimal remaining, BigDecimal overBy, boolean withinBudget,
                          BigDecimal suggestedBuffer, String bufferStatus) {}

    /** Parses LLM line items, skipping malformed ones (reported in {@code issues}). LIVE is never trusted. */
    public List<ExpenseLine> parseLines(JsonNode items, List<String> issues) {
        List<ExpenseLine> out = new ArrayList<>();
        if (items == null || !items.isArray()) return out;
        for (JsonNode it : items) {
            String desc = it.path("description").asText("").trim();
            BigDecimal unit = number(it.get("unitCost"));
            BigDecimal qty = number(it.get("quantity"));
            if (unit == null || qty == null || unit.signum() < 0 || qty.signum() <= 0
                    || unit.compareTo(MAX_UNIT_COST) > 0) {
                issues.add("Skipped invalid expense item: " + (desc.isEmpty() ? "(no description)" : desc));
                continue;
            }
            ExpenseCategory cat = ExpenseCategory.from(it.path("category").asText(null));
            if (cat == null) {
                cat = ExpenseCategory.MISCELLANEOUS;
                issues.add("Unknown expense category '" + it.path("category").asText("") + "' counted as MISCELLANEOUS");
            }
            DataType dt = DataType.from(it.path("dataType").asText(null));
            if (dt == DataType.LIVE) dt = DataType.ESTIMATED; // no live price provider is connected
            BigDecimal amount = unit.multiply(qty).setScale(0, RoundingMode.HALF_UP);
            out.add(new ExpenseLine(cat, desc.length() > 250 ? desc.substring(0, 250) : desc,
                    unit.setScale(2, RoundingMode.HALF_UP), qty.setScale(2, RoundingMode.HALF_UP), amount, dt));
        }
        return out;
    }

    public Summary summarise(List<ExpenseLine> lines, BigDecimal budget) {
        Map<ExpenseCategory, BigDecimal> by = new EnumMap<>(ExpenseCategory.class);
        for (ExpenseCategory c : ExpenseCategory.values()) by.put(c, BigDecimal.ZERO);
        BigDecimal total = BigDecimal.ZERO;
        for (ExpenseLine l : lines) {
            by.merge(l.category(), l.amount(), BigDecimal::add);
            total = total.add(l.amount());
        }
        BigDecimal remaining = budget.subtract(total);
        BigDecimal overBy = remaining.signum() < 0 ? remaining.negate() : BigDecimal.ZERO;
        BigDecimal suggestedBuffer = budget.multiply(BUFFER_FULL).setScale(0, RoundingMode.HALF_UP);
        BigDecimal ratio = budget.signum() == 0 ? BigDecimal.ZERO
                : remaining.divide(budget, 4, RoundingMode.HALF_UP);
        String bufferStatus = ratio.compareTo(BUFFER_FULL) >= 0 ? "FULL"
                : ratio.compareTo(BUFFER_MIN) >= 0 ? "PARTIAL" : "NONE";
        return new Summary(lines, by, total, budget, remaining, overBy, remaining.signum() >= 0,
                suggestedBuffer, bufferStatus);
    }

    public ObjectNode toJson(Summary s) {
        ObjectNode n = mapper.createObjectNode();
        ArrayNode items = n.putArray("items");
        for (ExpenseLine l : s.lines()) {
            ObjectNode i = items.addObject();
            i.put("category", l.category().name());
            i.put("description", l.description());
            i.put("unitCost", l.unitCost());
            i.put("quantity", l.quantity());
            i.put("amount", l.amount());
            i.put("dataType", l.dataType().name());
        }
        ObjectNode by = n.putObject("byCategory");
        s.byCategory().forEach((k, v) -> by.put(k.name(), v));
        n.put("total", s.total());
        n.put("budget", s.budget());
        n.put("remaining", s.remaining());
        n.put("overBy", s.overBy());
        n.put("withinBudget", s.withinBudget());
        ObjectNode buf = n.putObject("buffer");
        buf.put("suggestedAmount", s.suggestedBuffer());
        buf.put("status", s.bufferStatus()); // FULL (>=10% left) | PARTIAL (5-10%) | NONE
        return n;
    }

    public String overBudgetMessage(Summary s) {
        return "Your current plan is estimated at " + Money.inr(s.total()) + ", which is " + Money.inr(s.overBy())
                + " above your " + Money.inr(s.budget()) + " budget.";
    }

    private static BigDecimal number(JsonNode n) {
        if (n == null || n.isNull()) return null;
        if (n.isNumber()) return n.decimalValue();
        try {
            return new BigDecimal(n.asText().replaceAll("[^0-9.\\-]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
