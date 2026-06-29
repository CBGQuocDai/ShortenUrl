package com.backend.auth.service;

import com.backend.auth.dto.request.LoginRequest;
import com.backend.auth.dto.request.RegisterRequest;
import com.backend.auth.dto.request.VerifyOtpRequest;
import com.backend.auth.dto.response.TokenResponse;
import com.backend.auth.dto.response.UserResponse;
import org.springframework.security.core.userdetails.UserDetailsService;


public interface AuthService extends UserDetailsService {
    TokenResponse handleLogin(LoginRequest loginRequest);
    void handleRegister(RegisterRequest registerRequest);
    UserResponse getMe();
    void activateAccount(VerifyOtpRequest req);
}
