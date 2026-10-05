package com.naavi.tools;

import static org.junit.jupiter.api.Assertions.*;

import com.naavi.tools.BudgetSplitter.Split;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class BudgetSplitterTest {

    @Test
    void goaExample_30000_for_3_people_3_days() {
        Split s = BudgetSplitter.of(new BigDecimal("30000"), 3, 3);
        assertEquals(2, s.nights());
        assertEquals(1, s.rooms());
        assertEquals(0, new BigDecimal("10500").compareTo(s.transportTotal()));
        assertEquals(0, new BigDecimal("9000").compareTo(s.stayTotal()));
        assertEquals(0, new BigDecimal("3500").compareTo(s.transportCapPerPersonRoundTrip()));
        assertEquals(0, new BigDecimal("4500").compareTo(s.hotelCapPerRoomNight()));
        // shares add up to the whole budget
        BigDecimal sum = s.transportTotal().add(s.stayTotal()).add(s.foodAndLocalTotal()).add(s.buffer());
        assertEquals(0, new BigDecimal("30000").compareTo(sum));
    }

    @Test
    void largerGroupsGetMoreRooms() {
        assertEquals(1, BudgetSplitter.roomsFor(1));
        assertEquals(1, BudgetSplitter.roomsFor(3));
        assertEquals(2, BudgetSplitter.roomsFor(4));
        assertEquals(3, BudgetSplitter.roomsFor(5));
    }

    @Test
    void oneDayTripStillHasOneNight_and_badInputIsClamped() {
        Split s = BudgetSplitter.of(new BigDecimal("5000"), 0, 0);
        assertEquals(1, s.travelers());
        assertEquals(1, s.nights());
        assertThrows(IllegalArgumentException.class, () -> BudgetSplitter.of(BigDecimal.ZERO, 2, 2));
        assertThrows(IllegalArgumentException.class, () -> BudgetSplitter.of(null, 2, 2));
    }
}
