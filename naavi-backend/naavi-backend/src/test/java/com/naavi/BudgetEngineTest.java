package com.naavi;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.naavi.model.DataType;
import com.naavi.model.ExpenseCategory;
import com.naavi.service.BudgetEngine;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class BudgetEngineTest {
    private final ObjectMapper om = new ObjectMapper();
    private final BudgetEngine engine = new BudgetEngine(om);

    private List<BudgetEngine.ExpenseLine> lines(String json, List<String> issues) throws Exception {
        JsonNode items = om.readTree(json);
        return engine.parseLines(items, issues);
    }

    @Test
    void backendComputesAmountsTotalsAndBuffer() throws Exception {
        List<String> issues = new ArrayList<>();
        var l = lines("""
            [{"category":"TRANSPORTATION","description":"Train","unitCost":800,"quantity":4,"dataType":"LIVE"},
             {"category":"Hotel","description":"Stay","unitCost":1500,"quantity":3},
             {"category":"food","description":"Meals","unitCost":650,"quantity":10},
             {"category":"misc","description":"bad row","unitCost":-5,"quantity":1}]
            """, issues);

        assertEquals(3, l.size());
        assertEquals(1, issues.size());                       // negative row skipped
        assertEquals(DataType.ESTIMATED, l.get(0).dataType()); // LIVE is never trusted without a provider

        var s = engine.summarise(l, new BigDecimal("20000"));
        assertEquals(0, new BigDecimal("14200").compareTo(s.total()));      // 3200 + 4500 + 6500
        assertEquals(0, new BigDecimal("5800").compareTo(s.remaining()));
        assertTrue(s.withinBudget());
        assertEquals("FULL", s.bufferStatus());
    }

    @Test
    void reportsOverBudget() throws Exception {
        var l = lines("[{\"category\":\"ACCOMMODATION\",\"description\":\"Resort\",\"unitCost\":9000,\"quantity\":3}]",
                new ArrayList<>());
        var s = engine.summarise(l, new BigDecimal("25000"));
        assertFalse(s.withinBudget());
        assertEquals(0, new BigDecimal("2000").compareTo(s.overBy()));
        assertEquals("NONE", s.bufferStatus());
    }

    @Test
    void categoryLabelsAreMappedLeniently() {
        assertEquals(ExpenseCategory.LOCAL_TRANSPORT, ExpenseCategory.from("Local Travel"));
        assertEquals(ExpenseCategory.TRANSPORTATION, ExpenseCategory.from("Intercity transport"));
        assertEquals(ExpenseCategory.ACCOMMODATION, ExpenseCategory.from("hotel"));
        assertEquals(ExpenseCategory.MISCELLANEOUS, ExpenseCategory.from("Parking"));
        assertNull(ExpenseCategory.from("zzz"));
    }
}
