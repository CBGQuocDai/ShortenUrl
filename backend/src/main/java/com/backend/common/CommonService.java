package com.backend.common;


import com.backend.auth.entity.User;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Objects;

public interface CommonService {
    default User currentUser() {
        return (User) Objects.requireNonNull(SecurityContextHolder.getContext().getAuthentication()).getPrincipal();
    }
}
