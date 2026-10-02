package com.naavi.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.Locale;

public final class Money {
    private Money() {}

    /** Formats like ₹1,25,000 (Indian digit grouping). */
    public static String inr(BigDecimal value) {
        NumberFormat nf = NumberFormat.getIntegerInstance(Locale.forLanguageTag("en-IN"));
        return "₹" + nf.format(value.setScale(0, RoundingMode.HALF_UP));
    }
}
