package com.carrental.city;

import com.carrental.city.dto.CityInfo;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Operating cities for the trip form's pickup/destination autocomplete.
 *   GET /api/cities
 */
@RestController
public class CityController {

    private final CityService cities;

    public CityController(CityService cities) {
        this.cities = cities;
    }

    @GetMapping("/api/cities")
    public List<CityInfo> cities() {
        return cities.operatingCities();
    }
}
