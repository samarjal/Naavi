package com.naavi.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.naavi.entity.ChatMessage;
import com.naavi.entity.Itinerary;
import com.naavi.model.MessageRole;
import com.naavi.service.ItineraryService;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Answers follow-up questions about an existing plan without regenerating it. */
@Service
@RequiredArgsConstructor
public class TripQaService {
    private static final int MAX_CONTEXT_CHARS = 14_000;

    private final GroqClient groq;
    private final ItineraryService itineraryService;

    public String answer(Itinerary latest, List<ChatMessage> history, String question) {
        JsonNode plan = itineraryService.readPlan(latest);
        ObjectNode compact = itineraryService.compact(plan);
        compact.set("weather", plan.path("weather"));
        String ctx = compact.toString();
        if (ctx.length() > MAX_CONTEXT_CHARS) ctx = ctx.substring(0, MAX_CONTEXT_CHARS);

        List<GroqClient.Msg> msgs = new ArrayList<>();
        msgs.add(GroqClient.Msg.system("""
            You are Naavi, a friendly travel assistant. Answer the user's question about THEIR current trip using only the trip data below.
            Prices are estimates unless marked LIVE. Be concise (a few sentences). If the data doesn't contain the answer, say you're not sure.
            If the user wants something changed, tell them to describe the change (for example "make the hotel cheaper") and you'll update the plan.

            TRIP DATA:
            """ + ctx));
        for (ChatMessage m : history) {
            String c = m.getContent().length() > 600 ? m.getContent().substring(0, 600) : m.getContent();
            msgs.add(m.getRole() == MessageRole.USER ? GroqClient.Msg.user(c) : GroqClient.Msg.assistant(c));
        }
        msgs.add(GroqClient.Msg.user(question));
        return groq.chatText(msgs, 700).trim();
    }
}
