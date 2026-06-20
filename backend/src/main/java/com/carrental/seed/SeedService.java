package com.carrental.seed;

import com.carrental.agency.Agency;
import com.carrental.agency.AgencyMember;
import com.carrental.agency.AgencyMemberRepository;
import com.carrental.agency.AgencyRepository;
import com.carrental.agency.AgencyRole;
import com.carrental.agency.AgencyStatus;
import com.carrental.car.Car;
import com.carrental.car.CarRepository;
import com.carrental.car.CarStatus;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import net.datafaker.Faker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Bulk dev-data generator. Creates customers, agencies (each with an ADMIN
 * owner + a few STAFF) and a fleet of cars per agency. Idempotent-ish: skips
 * if the DB already looks seeded. Bookings/reviews are seeded later, once those
 * tables exist (Phase 2 / #39).
 */
@Service
public class SeedService {

    private static final Logger log = LoggerFactory.getLogger(SeedService.class);

    /** City -> approximate (lat, lng) so geo search has realistic data later. */
    private static final String[][] CITIES = {
            {"Mumbai", "19.0760", "72.8777"}, {"Delhi", "28.6139", "77.2090"},
            {"Bengaluru", "12.9716", "77.5946"}, {"Pune", "18.5204", "73.8567"},
            {"Hyderabad", "17.3850", "78.4867"}, {"Chennai", "13.0827", "80.2707"},
            {"Kolkata", "22.5726", "88.3639"}, {"Ahmedabad", "23.0225", "72.5714"},
            {"Jaipur", "26.9124", "75.7873"}, {"Gurugram", "28.4595", "77.0266"},
    };
    private static final String[] CATEGORIES = {"HATCHBACK", "SEDAN", "SUV", "MPV", "LUXURY"};

    private final UserRepository users;
    private final AgencyRepository agencies;
    private final AgencyMemberRepository members;
    private final CarRepository cars;
    private final PasswordEncoder passwordEncoder;

    public SeedService(UserRepository users, AgencyRepository agencies, AgencyMemberRepository members,
                       CarRepository cars, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.agencies = agencies;
        this.members = members;
        this.cars = cars;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void seed(int numCustomers, int numAgencies, int targetCars) {
        if (agencies.count() >= numAgencies) {
            log.info("Seed skipped: already have {} agencies (>= target {}).", agencies.count(), numAgencies);
            return;
        }
        long start = System.currentTimeMillis();
        Faker faker = new Faker();
        // Hash ONE password and reuse it — BCrypt is deliberately slow.
        String pwHash = passwordEncoder.encode("password123");
        int seq = (int) users.count();  // keep emails unique across runs

        // 1) standalone customers
        List<User> customerBatch = new ArrayList<>();
        for (int i = 0; i < numCustomers; i++) {
            customerBatch.add(newUser(faker, pwHash, "cust" + (seq++)));
        }
        users.saveAll(customerBatch);
        log.info("Seeded {} customers.", numCustomers);

        // 2) agencies, each with an ADMIN owner, 0-2 STAFF, and a fleet
        int carsPerAgency = Math.max(1, targetCars / numAgencies);
        int totalCars = 0;
        for (int a = 0; a < numAgencies; a++) {
            String[] city = CITIES[faker.random().nextInt(CITIES.length)];

            User owner = users.save(newUser(faker, pwHash, "owner" + (seq++)));
            Agency agency = new Agency();
            agency.setName(faker.company().name());
            agency.setOwner(owner);
            agency.setCity(city[0]);
            agency.setLatitude(Double.parseDouble(city[1]));
            agency.setLongitude(Double.parseDouble(city[2]));
            agency.setGstNo("GST" + faker.number().digits(12));
            agency.setStatus(AgencyStatus.ACTIVE);
            agencies.save(agency);

            members.save(member(owner, agency, AgencyRole.ADMIN));
            int staff = faker.random().nextInt(3);
            for (int s = 0; s < staff; s++) {
                User staffUser = users.save(newUser(faker, pwHash, "staff" + (seq++)));
                members.save(member(staffUser, agency, AgencyRole.STAFF));
            }

            List<Car> fleet = new ArrayList<>();
            for (int c = 0; c < carsPerAgency; c++) {
                fleet.add(newCar(faker, agency, city, a, c));
            }
            cars.saveAll(fleet);
            totalCars += fleet.size();

            if ((a + 1) % 50 == 0) {
                log.info("...seeded {} / {} agencies", a + 1, numAgencies);
            }
        }
        log.info("Seed complete: {} agencies, {} cars in {} ms. Login with password 'password123'.",
                numAgencies, totalCars, System.currentTimeMillis() - start);
    }

    private User newUser(Faker faker, String pwHash, String tag) {
        User u = new User();
        u.setName(faker.name().fullName());
        u.setEmail(tag + "@seed.local");      // guaranteed unique via tag
        u.setPhone("+9198" + faker.number().digits(8));
        u.setPasswordHash(pwHash);
        return u;
    }

    private AgencyMember member(User user, Agency agency, AgencyRole role) {
        AgencyMember m = new AgencyMember();
        m.setUser(user);
        m.setAgency(agency);
        m.setRole(role);
        return m;
    }

    private Car newCar(Faker faker, Agency agency, String[] city, int agencyIdx, int carIdx) {
        Car car = new Car();
        car.setAgency(agency);
        car.setMake(faker.vehicle().manufacturer());
        car.setModel(faker.vehicle().model());
        car.setCategory(CATEGORIES[faker.random().nextInt(CATEGORIES.length)]);
        car.setRegNo(String.format("SD%04d-%04d", agencyIdx, carIdx));   // unique per agency
        car.setPricePerDay(BigDecimal.valueOf(faker.number().numberBetween(800, 8000)));
        car.setLatitude(Double.parseDouble(city[1]));
        car.setLongitude(Double.parseDouble(city[2]));
        car.setStatus(CarStatus.AVAILABLE);
        return car;
    }
}
