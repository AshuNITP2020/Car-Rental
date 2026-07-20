package com.carrental.car;

import com.carrental.agency.Agency;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** A rentable car owned by an agency. */
@Entity
@Table(
    name = "car",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_car_agency_regno",
        columnNames = {"agency_id", "reg_no"}
    )
)
@Getter
@Setter
@NoArgsConstructor
public class Car {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Optimistic-lock counter; force-incremented per booking. */
    @Version
    @Column(nullable = false)
    private long version;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agency_id", nullable = false)
    private Agency agency;

    @Column(nullable = false, length = 60)
    private String make;

    @Column(nullable = false, length = 60)
    private String model;

    @Column(nullable = false, length = 40)
    private String category;

    /** Passenger seats — what customers filter by (with category), not make/model. */
    @Column(nullable = false)
    private Integer seats = 5;

    @Column(name = "reg_no", nullable = false, length = 20)
    private String regNo;

    @Column(name = "price_per_day", nullable = false, precision = 10, scale = 2)
    private BigDecimal pricePerDay;

    //TODO: Consider using separate entity for Gis Based Location
    private Double latitude;

    private Double longitude;

    /** Where the car actually is right now — a completed one-way trip leaves it
     *  at the drop city (V15). Falls back to the agency's city when null. */
    @Column(name = "current_city", length = 100)
    private String currentCity;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CarStatus status = CarStatus.AVAILABLE;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
