package com.backend.shortenUrl.controller;


import com.backend.common.dto.ApiResponse;
import com.backend.shortenUrl.dto.request.CreateRequest;
import com.backend.shortenUrl.dto.response.ShortenUrlResponse;
import com.backend.shortenUrl.service.ShortenUrlService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@RequestMapping("/shorten")
public class ShortenUrlController {
    private final ShortenUrlService shortenUrlService;
    @PostMapping("/create")
    public ResponseEntity<ApiResponse<ShortenUrlResponse>> createShortenUrl(@Valid @RequestBody CreateRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(
                ApiResponse.<ShortenUrlResponse>builder()
                        .data(shortenUrlService.createShortenUrl(req))
                        .build());
    }

    @PutMapping("/{code}")
    public ResponseEntity<ApiResponse<ShortenUrlResponse>> putShortenUrl(@PathVariable String code, @Valid @RequestBody CreateRequest req) {
        return ResponseEntity.ok(ApiResponse.<ShortenUrlResponse>builder()
                .data(shortenUrlService.updateShortenUrl(code, req))
                .build());
    }

    @GetMapping("/{code}")
    public ResponseEntity<?> getShortenUrl(@PathVariable String code) {
        return ResponseEntity.status(HttpStatus.PERMANENT_REDIRECT)
                .location(URI.create(shortenUrlService.retrieveOriginalUrl(code))).build();
    }
    @GetMapping
    public ResponseEntity<ApiResponse<?>> getStaticUrl(
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer size){
        return ResponseEntity.ok(ApiResponse.builder().data(shortenUrlService.getStaticUrl(page, size)).build());
    }
    @DeleteMapping("/{code}")
    public ResponseEntity<?> deleteShortenUrl(@PathVariable String code) {
        shortenUrlService.deleteShortenUrl(code);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}