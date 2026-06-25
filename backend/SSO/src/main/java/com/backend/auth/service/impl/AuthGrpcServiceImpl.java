package com.backend.auth.service.impl;

import com.backend.auth.entity.User;
import com.backend.auth.grpc.AuthServiceGrpc;
import com.backend.auth.grpc.ValidateTokenRequest;
import com.backend.auth.grpc.ValidateTokenResponse;
import com.backend.auth.repository.UserRepository;
import com.backend.common.utils.JwtUtils;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import net.devh.boot.grpc.server.service.GrpcService;
import lombok.RequiredArgsConstructor;
import io.grpc.stub.StreamObserver;

import java.util.Optional;

@GrpcService
@RequiredArgsConstructor
public class AuthGrpcServiceImpl extends AuthServiceGrpc.AuthServiceImplBase {

    private final JwtUtils jwtUtils;
    private final UserRepository userRepository;

    @Override
    public void validateToken(ValidateTokenRequest request, StreamObserver<ValidateTokenResponse> responseObserver) {
        String token = request.getToken();
        ValidateTokenResponse response = null;
        try {
            Claims claims = jwtUtils.parseToken(token);
            String username = claims.getSubject();
            
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isPresent()) {
                User user = userOpt.get();
                response = ValidateTokenResponse.newBuilder()
                        .setValid(true)
                        .setUserId(user.getId())
                        .setUsername(user.getUsername())
                        .setRole(user.getRole().name())
                        .build();
            } else {
                response = ValidateTokenResponse.newBuilder().setValid(false).build();
            }
        } catch (JwtException | IllegalArgumentException e) {
            response = ValidateTokenResponse.newBuilder().setValid(false).build();
        }

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
