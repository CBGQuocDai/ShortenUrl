package com.backend.auth.dto.request;


import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class VerifyOtpRequest {
    @Size(min=5, max=255, message="USERNAME_INVALID")
    private String username;

    private String otp;
}
