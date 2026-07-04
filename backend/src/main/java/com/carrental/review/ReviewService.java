package com.carrental.review;

import com.carrental.booking.Booking;
import com.carrental.booking.BookingRepository;
import com.carrental.booking.BookingStatus;
import com.carrental.review.dto.CarReviewsResponse;
import com.carrental.review.dto.ReviewResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Reviews & ratings (Task #39). A review can only be written by the booking's own
 * customer, only after the booking is COMPLETED, and only once. The per-car rating
 * is a straight aggregation (avg + count) over the denormalized {@code car_id}.
 */
@Service
public class ReviewService {

    private final ReviewRepository reviews;
    private final BookingRepository bookings;

    public ReviewService(ReviewRepository reviews, BookingRepository bookings) {
        this.reviews = reviews;
        this.bookings = bookings;
    }

    @Transactional
    public ReviewResponse create(Long userId, Long bookingId, Integer rating, String comment) {
        if (rating == null || rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "rating must be between 1 and 5");
        }

        Booking booking = bookings.findByIdAndUser_Id(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        if (booking.getStatus() != BookingStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You can only review a completed booking");
        }
        if (reviews.existsByBookingId(bookingId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This booking has already been reviewed");
        }

        Review review = new Review();
        review.setBookingId(bookingId);
        review.setCarId(booking.getCar().getId());
        review.setUserId(userId);
        review.setRating(rating);
        review.setComment(comment);
        try {
            reviews.saveAndFlush(review);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This booking has already been reviewed");
        }
        return ReviewResponse.from(review);
    }

    @Transactional(readOnly = true)
    public ReviewResponse getForBooking(Long userId, Long bookingId) {
        bookings.findByIdAndUser_Id(bookingId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        Review review = reviews.findByBookingId(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No review for this booking"));
        return ReviewResponse.from(review);
    }

    @Transactional(readOnly = true)
    public CarReviewsResponse carReviews(Long carId) {
        RatingSummaryRow summary = reviews.ratingSummary(carId);
        Double average = summary.getAverage() == null
                ? null : Math.round(summary.getAverage() * 10.0) / 10.0;   // 1 decimal
        List<ReviewResponse> list = reviews.findByCarIdOrderByIdDesc(carId)
                .stream().map(ReviewResponse::from).toList();
        return new CarReviewsResponse(average, summary.getCount(), list);
    }
}
