package com.backend.auth.service.impl;

import com.backend.auth.dto.request.LoginRequest;
import com.backend.auth.dto.request.RegisterRequest;
import com.backend.auth.dto.response.TokenResponse;
import com.backend.auth.dto.response.UserResponse;
import com.backend.auth.entity.User;
import com.backend.auth.repository.UserRepository;
import com.backend.auth.service.AuthService;
import com.backend.common.utils.JwtUtils;
import com.backend.error.AppException;
import com.backend.error.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsername(username);
    }

    @Override
    public TokenResponse handleLogin(LoginRequest loginRequest) {
        User u = userRepository.findByUsername(loginRequest.getUsername());
        if(Objects.isNull(u)) {
            throw new AppException(ErrorCode.LOGIN_FAILED);
        }
        if(!passwordEncoder.matches(loginRequest.getPassword(), u.getPassword())) {
            throw new AppException(ErrorCode.LOGIN_FAILED);
        }
        return TokenResponse.builder()
                .token(jwtUtils.generateToken(u))
                .build();
    }

    @Override
    public void handleRegister(RegisterRequest registerRequest) {
        User user = userRepository.findByUsername(registerRequest.getUsername());
        if(Objects.nonNull(user)) {
            throw new AppException(ErrorCode.USERNAME_EXISTS);
        }
        User u = new User();
        u.setUsername(registerRequest.getUsername());
        u.setPassword(passwordEncoder.encode(registerRequest.getPassword()));
        userRepository.save(u);
    }

    @Override
    public UserResponse getMe() {
        User u = (User) Objects.requireNonNull(SecurityContextHolder.getContext().getAuthentication()).getPrincipal();
        assert u != null;
        return UserResponse.builder()
                .id(u.getId())
                .username(u.getUsername())
                .role(u.getRole())
                .build();
    }
}
