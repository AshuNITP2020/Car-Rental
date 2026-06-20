package com.carrental.user;

/** KYC verification state of a user. Persisted as its name (e.g. "PENDING"). */
public enum KycStatus {
    PENDING,
    VERIFIED,
    REJECTED
}
