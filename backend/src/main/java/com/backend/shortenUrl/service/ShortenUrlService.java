package com.backend.shortenUrl.service;

import com.backend.shortenUrl.dto.request.CreateRequest;
import com.backend.shortenUrl.dto.response.ShortenUrlResponse;
import com.backend.shortenUrl.dto.response.ShortenUrlStatResponse;
import org.springframework.data.domain.Page;

public interface ShortenUrlService {
    String retrieveOriginalUrl(String shortCode);
    ShortenUrlResponse createShortenUrl(CreateRequest req);
    ShortenUrlResponse updateShortenUrl(Long id, CreateRequest req);
    Page<ShortenUrlStatResponse> getStat(Integer page, Integer size);
    void deleteShortenUrl(Long id);
}
