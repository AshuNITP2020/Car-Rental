package com.carrental.agency.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateAgencyRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 100) String city,
        @Size(max = 20) String gstNo,
        @Size(max = 100) String payoutAccount,
        Double latitude,
        Double longitude
) {
}
