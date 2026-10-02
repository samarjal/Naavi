package com.naavi.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.naavi.config.AppProperties;
import com.naavi.exception.AiServiceException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/** Thin client for Groq's OpenAI-compatible chat completions endpoint. The API key never leaves the server. */
@Component
@Slf4j
public class GroqClient {
    private static final int MAX_ATTEMPTS = 3;

    private final RestClient rest;
    private final AppProperties.Groq cfg;
    private final ObjectMapper mapper;

    public record Msg(String role, String content) {
        public static Msg system(String c) { return new Msg("system", c); }
        public static Msg user(String c) { return new Msg("user", c); }
        public static Msg assistant(String c) { return new Msg("assistant", c); }
    }

    public GroqClient(AppProperties props, ObjectMapper mapper) {
        this.cfg = props.groq();
        this.mapper = mapper;
        if (cfg.apiKey() == null || cfg.apiKey().isBlank()) {
            throw new IllegalStateException("GROQ_API_KEY is not set");
        }
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(cfg.timeoutSeconds() * 1000);
        this.rest = RestClient.builder()
                .baseUrl(cfg.baseUrl())
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + cfg.apiKey())
                .build();
    }

    /** Plain text completion. */
    public String chatText(List<Msg> messages, int maxTokens) {
        return complete(messages, maxTokens, false);
    }

    /** JSON-mode completion; returns the parsed object. */
    public JsonNode chatJson(List<Msg> messages, int maxTokens) {
        String content = complete(messages, maxTokens, true);
        try {
            return mapper.readTree(content);
        } catch (JsonProcessingException e) {
            throw new AiServiceException("The AI returned invalid JSON.", e);
        }
    }

    private String complete(List<Msg> messages, int maxTokens, boolean json) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", cfg.model());
        body.put("messages", messages);
        body.put("temperature", cfg.temperature());
        body.put("max_tokens", maxTokens);
        if (json) body.put("response_format", Map.of("type", "json_object"));

        for (int attempt = 1; ; attempt++) {
            try {
                String resp = rest.post().uri("/chat/completions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
                String content = mapper.readTree(resp).path("choices").path(0).path("message").path("content").asText(null);
                if (content == null || content.isBlank()) throw new AiServiceException("The AI returned an empty response.");
                return content;
            } catch (RestClientResponseException e) {
                int status = e.getStatusCode().value();
                boolean retryable = status == 429 || status >= 500;
                log.warn("Groq HTTP {} (attempt {}/{})", status, attempt, MAX_ATTEMPTS);
                if (!retryable || attempt >= MAX_ATTEMPTS) {
                    throw new AiServiceException(status == 429
                            ? "The AI service is busy (rate limited). Please try again in a moment."
                            : "The AI service returned an error (HTTP " + status + ").", e);
                }
                sleep(backoffMillis(e, attempt));
            } catch (ResourceAccessException e) {
                log.warn("Groq unreachable/timeout (attempt {}/{}): {}", attempt, MAX_ATTEMPTS, e.getMessage());
                if (attempt >= MAX_ATTEMPTS) throw new AiServiceException("The AI service timed out or is unreachable.", e);
                sleep(1500L * attempt);
            } catch (JsonProcessingException e) {
                throw new AiServiceException("Malformed response from the AI service.", e);
            }
        }
    }

    private static long backoffMillis(RestClientResponseException e, int attempt) {
        String retryAfter = e.getResponseHeaders() == null ? null : e.getResponseHeaders().getFirst("retry-after");
        if (retryAfter != null) {
            try {
                return Math.min(15_000L, (long) (Double.parseDouble(retryAfter) * 1000) + 250);
            } catch (NumberFormatException ignored) {
                // fall through to exponential backoff
            }
        }
        return Math.min(15_000L, 2000L * attempt);
    }

    private static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new AiServiceException("Interrupted while waiting for the AI service.");
        }
    }
}
