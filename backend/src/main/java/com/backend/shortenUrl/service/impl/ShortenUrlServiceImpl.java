package com.backend.shortenUrl.service.impl;


import com.backend.shortenUrl.dto.request.CreateRequest;
import com.backend.shortenUrl.dto.response.ShortenUrlResponse;
import com.backend.shortenUrl.dto.response.ShortenUrlStatResponse;
import com.backend.shortenUrl.entity.ShortenUrl;
import com.backend.shortenUrl.mapper.ShortenUrlMapper;
import com.backend.shortenUrl.repository.ShortenUrlRepository;
import com.backend.shortenUrl.service.ShortenUrlService;
import com.backend.common.CurrentUserProvider;
import com.backend.error.AppException;
import com.backend.error.ErrorCode;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ShortenUrlServiceImpl implements ShortenUrlService {

    private final ShortenUrlRepository shortenUrlRepository;
    private final ShortenUrlMapper shortenUrlMapper;
    private final CurrentUserProvider currentUserProvider;

    @Transactional
    @Override
    public String retrieveOriginalUrl(String shortCode) {
        ShortenUrl url = shortenUrlRepository.findByShortCode(shortCode)
                .orElseThrow(() -> new AppException(ErrorCode.URL_NOT_FOUND));
        shortenUrlRepository.incrementAccessCount(url.getId());
        return url.getUrl();
    }

    @Transactional
    @Override
    public ShortenUrlResponse createShortenUrl(CreateRequest req) {
        if (shortenUrlRepository.existsByShortCode(req.getShortCode())) {
            throw new AppException(ErrorCode.SHORT_CODE_EXISTS);
        }
        ShortenUrl url = ShortenUrl.builder()
                .shortCode(req.getShortCode())
                .url(req.getUrl())
                .accessCount(0L)
                .ownerId(currentUserProvider.getCurrentUserId())
                .build();
        return shortenUrlMapper.toResponse(url);
    }

    @Transactional
    @Override
    public ShortenUrlResponse updateShortenUrl(Long id, CreateRequest req) {
        ShortenUrl url = loadOwnedOrThrow(id);
        url.setUrl(req.getUrl());
        url.setShortCode(req.getShortCode());
        return shortenUrlMapper.toResponse(url);
    }

    @Transactional
    @Override
    public Page<ShortenUrlStatResponse> getStat(Integer page, Integer size) {
        Long ownerId = currentUserProvider.getCurrentUserId();
        return shortenUrlRepository
                .findAllByOwnerId(ownerId, PageRequest.of(page, size))
                .map(shortenUrlMapper::toStatResponse);
    }

    @Transactional
    @Override
    public void deleteShortenUrl(Long id) {
        ShortenUrl url = loadOwnedOrThrow(id);
        shortenUrlRepository.delete(url);
    }

    private ShortenUrl loadOwnedOrThrow(Long id) {
        ShortenUrl url = shortenUrlRepository.findById(id)
                .orElseThrow(() -> new AppException(ErrorCode.URL_NOT_FOUND));
        if (!url.isOwnedBy(currentUserProvider.getCurrentUserId())) {
            throw new AppException(ErrorCode.NOT_PERMISSION);
        }
        return url;
    }
}
