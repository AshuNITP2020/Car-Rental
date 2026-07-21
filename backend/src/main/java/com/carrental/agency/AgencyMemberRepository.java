package com.carrental.agency;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AgencyMemberRepository extends JpaRepository<AgencyMember, Long> {

    /**
     * The user's agency membership. We assume at most one for now (a staff
     * member belongs to one agency); if a user joins several later, this picks
     * the earliest and we'd extend to an "active agency" selector.
     */
    Optional<AgencyMember> findFirstByUser_IdOrderByIdAsc(Long userId);

    /** Is this user part of ANY agency? (agency accounts are supply-side only) */
    boolean existsByUser_Id(Long userId);
}
