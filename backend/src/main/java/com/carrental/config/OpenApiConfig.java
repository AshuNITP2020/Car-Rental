package com.carrental.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger / OpenAPI docs (springdoc): UI at {@code /swagger-ui.html}, spec at
 * {@code /v3/api-docs}. All endpoints except auth need a Bearer JWT — the
 * scheme below powers the UI's "Authorize" button: log in via
 * {@code POST /api/auth/login}, paste the {@code accessToken}, and every
 * try-it-out request carries it.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER = "bearerAuth";

    @Bean
    public OpenAPI carRentalOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("CarRental Marketplace API")
                        .version("v1")
                        .description("""
                                A marketplace of local rental agencies. Customers plan a trip \
                                (pickup + destination anywhere in India), see every agency whose \
                                operating area covers the WHOLE route, and book by car type + seats. \
                                Agencies manage their fleet, operating area and bookings; platform \
                                admins approve agencies.

                                Authenticate via POST /api/auth/login, then click Authorize and \
                                paste the accessToken. Times are ISO-8601 with offset; money is INR."""))
                .components(new Components().addSecuritySchemes(BEARER,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("JWT from POST /api/auth/login (accessToken)")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
