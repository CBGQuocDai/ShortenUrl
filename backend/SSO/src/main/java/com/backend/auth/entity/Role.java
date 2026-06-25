package com.backend.auth.entity;

public enum Role {
    USER,
    ADMIN;

    public String asAuthority() {
        return "ROLE_" + name();
    }
}
