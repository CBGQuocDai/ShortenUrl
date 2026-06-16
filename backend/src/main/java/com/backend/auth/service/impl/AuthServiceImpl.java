package com.backend.auth.service.impl;

import com.backend.auth.dto.request.LoginRequest;
import com.backend.auth.dto.request.RegisterRequest;
import com.backend.auth.dto.response.TokenResponse;
import com.backend.auth.dto.response.UserResponse;
import com.backend.auth.entity.Role;
import com.backend.auth.entity.User;
import com.backend.auth.repository.UserRepository;
import com.backend.auth.service.AuthService;
import com.backend.common.utils.JwtUtils;
import com.backend.error.AppException;
import com.backend.error.ErrorCode;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException(username));
    }

    @Transactional
    @Override
    public TokenResponse handleLogin(LoginRequest loginRequest) {
        User user = userRepository.findByUsername(loginRequest.getUsername())
                .orElseThrow(() -> new AppException(ErrorCode.LOGIN_FAILED));
        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPassword())) {
            throw new AppException(ErrorCode.LOGIN_FAILED);
        }
        return TokenResponse.builder()
                .token(jwtUtils.generateToken(user))
                .build();
    }

    @Transactional
    @Override
    public void handleRegister(RegisterRequest registerRequest) {
        if (userRepository.existsByUsername(registerRequest.getUsername())) {
            throw new AppException(ErrorCode.USERNAME_EXISTS);
        }
        User user = User.builder()
                .username(registerRequest.getUsername())
                .password(passwordEncoder.encode(registerRequest.getPassword()))
                .role(Role.USER)
                .build();
        userRepository.save(user);
    }

    @Transactional
    @Override
    public UserResponse getMe() {
        User user = (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        return UserResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .role(user.getRole().name())
                .build();
    }
}
