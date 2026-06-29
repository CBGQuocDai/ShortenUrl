package com.backend.auth.service.impl;

import com.backend.auth.dto.request.LoginRequest;
import com.backend.auth.dto.request.RegisterRequest;
import com.backend.auth.dto.request.VerifyOtpRequest;
import com.backend.auth.dto.response.TokenResponse;
import com.backend.auth.dto.response.UserResponse;
import com.backend.auth.entity.Role;
import com.backend.auth.entity.User;
import com.backend.auth.repository.UserRepository;
import com.backend.common.utils.JwtUtils;
import com.backend.auth.service.AuthService;
import com.backend.common.utils.OtpUtils;
import com.backend.error.AppException;
import com.backend.error.ErrorCode;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.types.Expiration;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final RedisTemplate<String, Object> redisTemplate;

    @Override
    @Transactional
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsernameAndEnabled(username,true)
                .orElseThrow(() -> new UsernameNotFoundException(username));
    }

    @Transactional
    @Override
    public TokenResponse handleLogin(LoginRequest loginRequest) {
        User user = userRepository.findByUsernameAndEnabled(loginRequest.getUsername(),true)
                .orElseThrow(() -> new AppException(ErrorCode.LOGIN_FAILED));
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.LOGIN_FAILED);
        }
        return TokenResponse.builder()
                .token(jwtUtils.generateToken(user.getUsername()))
                .build();
    }

    @Transactional
    @Override
    public void handleRegister(RegisterRequest registerRequest) {
        User u= userRepository.findByUsername(registerRequest.getUsername()).orElse(null);
        if(Objects.nonNull(u)) {
            if(u.isEnabled()) {
                throw new AppException(ErrorCode.USERNAME_EXISTS);
            }
            else {
                u.setRole(Role.USER);
                u.setUsername(registerRequest.getUsername());
                u.setPassword(passwordEncoder.encode(registerRequest.getPassword()));
            }
        } else {
            u = User.builder()
                    .username(registerRequest.getUsername())
                    .password(passwordEncoder.encode(registerRequest.getPassword()))
                    .role(Role.USER)
                    .build();
        }
        String otpCode = OtpUtils.randomOtpCode();
        log.info("OTP Code: {}", otpCode);
        redisTemplate.opsForValue().set("otp::"+u.getUsername(), otpCode, Expiration.from(10, TimeUnit.MINUTES));
        userRepository.save(u);
    }

    @Transactional
    @Override
    public UserResponse getMe() {
        User user = (User) Objects.requireNonNull(SecurityContextHolder.getContext().getAuthentication()).getPrincipal();
        assert user != null;
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .role(user.getRole().name())
                .build();
    }

    @Override
    public void activateAccount(VerifyOtpRequest req) {
        User u = userRepository.findByUsername(req.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.USERNAME_NOT_EXISTS));
        String otpCode = Objects.requireNonNull(redisTemplate.opsForValue().get("otp::" + req.getUsername())).toString();
        if (otpCode.equals(req.getOtp())) {
            u.setEnabled(true);
            userRepository.save(u);
        } else {
            throw new AppException(ErrorCode.OTP_INVALID);
        }
    }
}
