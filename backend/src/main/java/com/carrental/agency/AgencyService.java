package com.carrental.agency;

import com.carrental.agency.dto.AgencyResponse;
import com.carrental.agency.dto.CreateAgencyRequest;
import com.carrental.agency.dto.UpdateAgencyRequest;
import com.carrental.config.CacheConfig;
import com.carrental.user.User;
import com.carrental.user.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AgencyService {

    private final AgencyRepository agencies;
    private final AgencyMemberRepository members;
    private final UserRepository users;

    public AgencyService(AgencyRepository agencies, AgencyMemberRepository members, UserRepository users) {
        this.agencies = agencies;
        this.members = members;
        this.users = users;
    }

    /**
     * Creates an agency and makes the creator its ADMIN member, atomically.
     * That agency_member row is what gives the user a tenant (agencyId) on
     * their next login/refresh. One agency per user for now.
     */
    @CacheEvict(cacheNames = CacheConfig.CAR_SEARCH_CACHE, allEntries = true)
    @Transactional
    public AgencyResponse create(Long userId, CreateAgencyRequest req) {
        if (members.findFirstByUser_IdOrderByIdAsc(userId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already belongs to an agency");
        }
        User owner = users.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        Agency agency = new Agency();
        agency.setName(req.name().trim());
        agency.setOwner(owner);
        agency.setCity(req.city());
        agency.setGstNo(req.gstNo());
        agency.setPayoutAccount(req.payoutAccount());
        agency.setLatitude(req.latitude());
        agency.setLongitude(req.longitude());
        agency.setStatus(AgencyStatus.PENDING);
        agencies.save(agency);

        AgencyMember member = new AgencyMember();
        member.setUser(owner);
        member.setAgency(agency);
        member.setRole(AgencyRole.ADMIN);
        members.save(member);

        return AgencyResponse.from(agency);
    }

    @Transactional(readOnly = true)
    public AgencyResponse get(Long agencyId) {
        return agencies.findById(agencyId)
                .map(AgencyResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agency not found"));
    }

    @CacheEvict(cacheNames = CacheConfig.CAR_SEARCH_CACHE, allEntries = true)
    @Transactional
    public AgencyResponse update(Long agencyId, UpdateAgencyRequest req) {
        Agency agency = agencies.findById(agencyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agency not found"));
        agency.setName(req.name().trim());
        agency.setCity(req.city());
        agency.setGstNo(req.gstNo());
        agency.setPayoutAccount(req.payoutAccount());
        agency.setLatitude(req.latitude());
        agency.setLongitude(req.longitude());
        return AgencyResponse.from(agency);
    }

    /**
     * Platform-admin lifecycle decision. ACTIVE agencies appear in search;
     * PENDING/SUSPENDED ones are invisible to customers (enforced in the
     * search SQL and covers checks). Evicts search caches so the flip is
     * immediately visible.
     */
    @CacheEvict(cacheNames = CacheConfig.CAR_SEARCH_CACHE, allEntries = true)
    @Transactional
    public AgencyResponse updateStatus(Long agencyId, AgencyStatus status) {
        Agency agency = agencies.findById(agencyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Agency not found"));
        agency.setStatus(status);
        return AgencyResponse.from(agency);
    }
}
