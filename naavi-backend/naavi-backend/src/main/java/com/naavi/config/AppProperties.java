package com.naavi.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "naavi")
public record AppProperties(Jwt jwt, Groq groq, Cors cors) {
    public record Jwt(String secret, long expirationMinutes) {}

    public record Groq(String apiKey, String baseUrl, String model, double temperature,
                       int maxTokens, int timeoutSeconds) {}

    public record Cors(List<String> allowedOrigins) {}
}
