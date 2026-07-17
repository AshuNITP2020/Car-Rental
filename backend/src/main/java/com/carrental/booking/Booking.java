package com.carrental.booking;

import com.carrental.agency.Agency;
import com.carrental.car.Car;
import com.carrental.user.User;
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
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * A reservation of one car for a time window. The no-overlap guarantee lives in
 * the DB (V3 exclusion constraint), not here — the range is expressed by
 * start_ts/end_ts and the constraint compares tstzrange(start, end, '[)').
 */
@Entity
@Table(name = "booking")
@Getter
@Setter
@NoArgsConstructor
public class Booking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "car_id", nullable = false)
    private Car car;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agency_id", nullable = false)
    private Agency agency;

    @Column(name = "start_ts", nullable = false)
    private OffsetDateTime startTs;

    @Column(name = "end_ts", nullable = false)
    private OffsetDateTime endTs;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BookingStatus status = BookingStatus.PENDING;

    @Column(precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(precision = 12, scale = 2)
    private BigDecimal deposit;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    /** Round trip (car returns to pickup) or one-way drop-off (V15). */
    @Enumerated(EnumType.STRING)
    @Column(name = "trip_type", nullable = false, length = 20)
    private TripType tripType = TripType.ROUND_TRIP;

    /** Human-readable pickup label (nearest operating city at booking time). */
    @Column(name = "pickup_city", length = 100)
    private String pickupCity;

    /** One-way only: human-readable drop label (nearest operating city). */
    @Column(name = "drop_city", length = 100)
    private String dropCity;

    /** Exact pickup point (the car's location at booking time, V16). */
    @Column(name = "pickup_lat")
    private Double pickupLat;

    @Column(name = "pickup_lng")
    private Double pickupLng;

    /** One-way only: the exact map point the car is dropped at (V16). */
    @Column(name = "drop_lat")
    private Double dropLat;

    @Column(name = "drop_lng")
    private Double dropLng;

    /** One-way relocation fee charged to the customer (0 for round trips). */
    @Column(name = "one_way_fee", nullable = false, precision = 12, scale = 2)
    private BigDecimal oneWayFee = BigDecimal.ZERO;

    @Column(name = "idempotency_key", length = 80)
    private String idempotencyKey;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;
}
