package com.carrental.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

/**
 * Every response carries an X-Request-Id correlation id — minted when
 * absent, and echoed (propagated) when the caller supplies one.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CorrelationIdTest {

    @Autowired MockMvc mvc;

    @Test
    void mintsARequestIdWhenNoneSupplied() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(header().string("X-Request-Id", matchesPattern("[0-9a-fA-F-]{36}")));
    }

    @Test
    void echoesAnInboundRequestId() throws Exception {
        mvc.perform(get("/api/health").header("X-Request-Id", "upstream-abc-123"))
                .andExpect(header().string("X-Request-Id", "upstream-abc-123"));
    }
}
