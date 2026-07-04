-- V10: case-insensitive search indexes. V1 already indexes
-- car (price_per_day), car (category), car (status) and agency (city) as plain
-- btrees. But the customer search compares city and category case-insensitively
-- (lower(col) = lower(:param)), which a plain btree can't serve — so add
-- functional indexes on the lower(...) expressions. Price is numeric and matched
-- by range, so V1's idx_car_price already suffices (no new index needed).
CREATE INDEX idx_car_category_lower ON car (lower(category));
CREATE INDEX idx_agency_city_lower ON agency (lower(city));
