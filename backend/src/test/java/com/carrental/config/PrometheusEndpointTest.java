package com.carrental.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The app exposes Prometheus-format metrics at {@code /actuator/prometheus}
 * (public, like the other actuator endpoints) with the {@code application} common
 * tag — this is what the Prometheus container scrapes. @SpringBootTest disables
 * metrics export by default (so multiple test contexts don't fight over the shared
 * Prometheus registry), so this test re-enables it for its own context only.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "management.prometheus.metrics.export.enabled=true")
class PrometheusEndpointTest {

    @Autowired MockMvc mvc;

    @Test
    void prometheusEndpoint_exposesTaggedMetrics() throws Exception {
        mvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("jvm_memory_used_bytes")))
                .andExpect(content().string(containsString("application=\"car-rental-backend\"")));
    }
}
