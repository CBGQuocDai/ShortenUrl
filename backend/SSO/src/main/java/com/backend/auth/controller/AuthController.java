package com.backend.auth.controller;


import com.backend.auth.dto.request.LoginRequest;
import com.backend.auth.dto.request.RegisterRequest;
import com.backend.auth.dto.request.VerifyOtpRequest;
import com.backend.auth.dto.response.TokenResponse;
import com.backend.auth.dto.response.UserResponse;
import com.backend.auth.service.AuthService;
import com.backend.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<TokenResponse>> login(@Valid @RequestBody LoginRequest loginRequest) {
        return ResponseEntity.ok(ApiResponse.<TokenResponse>builder()
                .data(authService.handleLogin(loginRequest))
                .build());
    }
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<?>> register(@Valid @RequestBody RegisterRequest registerRequest) {
        authService.handleRegister(registerRequest);
        return ResponseEntity.ok(ApiResponse.builder().build());
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserResponse>> me() {
        return ResponseEntity.ok(ApiResponse.<UserResponse>builder()
                        .data(authService.getMe())
                .build());
    }
    @PostMapping("/otp-verify")
    public ResponseEntity<ApiResponse<?>> otpVerify(@Valid @RequestBody VerifyOtpRequest verifyOtpRequest) {
        authService.activateAccount(verifyOtpRequest);
        return ResponseEntity.ok(ApiResponse.builder().build());
    }
}
