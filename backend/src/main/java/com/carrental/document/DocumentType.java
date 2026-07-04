package com.carrental.document;

/**
 * Kinds of private document, each bound to the owner it belongs to. KYC types are
 * a user's identity docs; INSURANCE/REGISTRATION are a car's papers. The service
 * checks the uploaded type matches the endpoint's owner.
 */
public enum DocumentType {
    KYC_IDENTITY(DocumentOwnerType.USER),
    KYC_ADDRESS(DocumentOwnerType.USER),
    INSURANCE(DocumentOwnerType.CAR),
    REGISTRATION(DocumentOwnerType.CAR);

    private final DocumentOwnerType ownerType;

    DocumentType(DocumentOwnerType ownerType) {
        this.ownerType = ownerType;
    }

    public DocumentOwnerType ownerType() {
        return ownerType;
    }

    /** True for user identity docs — the ones whose review drives {@code user.kycStatus}. */
    public boolean isKyc() {
        return ownerType == DocumentOwnerType.USER;
    }
}
