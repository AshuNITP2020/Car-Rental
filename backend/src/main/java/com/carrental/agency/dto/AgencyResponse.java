package com.carrental.agency.dto;

import com.carrental.agency.Agency;

public record AgencyResponse(
        Long id,
        String name,
        Long ownerId,
        String city,
        Double latitude,
        Double longitude,
        String gstNo,
        String payoutAccount,
        String status
) {
    public static AgencyResponse from(Agency a) {
        return new AgencyResponse(
                a.getId(),
                a.getName(),
                a.getOwner().getId(),
                a.getCity(),
                a.getLatitude(),
                a.getLongitude(),
                a.getGstNo(),
                a.getPayoutAccount(),
                a.getStatus().name());
    }
}
