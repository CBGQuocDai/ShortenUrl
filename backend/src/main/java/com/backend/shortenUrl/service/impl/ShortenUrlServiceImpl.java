package com.backend.shortenUrl.service.impl;

import com.backend.auth.entity.User;
import com.backend.shortenUrl.dto.request.CreateRequest;
import com.backend.shortenUrl.dto.response.ShortenUrlResponse;
import com.backend.shortenUrl.dto.response.ShortenUrlStatResponse;
import com.backend.shortenUrl.entity.ShortenUrl;
import com.backend.error.AppException;
import com.backend.error.ErrorCode;
import com.backend.shortenUrl.mapper.ShortenUrlMapper;
import com.backend.shortenUrl.repository.ShortenUrlRepository;
import com.backend.shortenUrl.service.ShortenUrlService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class ShortenUrlServiceImpl implements ShortenUrlService {
    private final ShortenUrlRepository shortenUrlRepository;
    private final ShortenUrlMapper shortenUrlMapper;
    @Override
    public String retrieveOriginalUrl(String shortCode) {
        ShortenUrl url = shortenUrlRepository.findByShortCode(shortCode).orElseThrow(() -> new AppException(ErrorCode.URL_NOT_FOUND));
        url.setAccessCount(url.getAccessCount() + 1);
        shortenUrlRepository.save(url);
        return url.getUrl();
    }

    @Override
    public ShortenUrlResponse createShortenUrl(CreateRequest req) {
        if(shortenUrlRepository.existsByShortCode(req.getShortCode())) {
            throw new AppException(ErrorCode.SHORT_CODE_EXISTS);
        }
        ShortenUrl url = new ShortenUrl();
        url.setUrl(req.getUrl());
        url.setCreatedAt(LocalDateTime.now());
        url.setUpdatedAt(LocalDateTime.now());
        url.setAccessCount(0L);
        url.setShortCode(req.getShortCode());
        User user = currentUser();
        url.setUser(user);
        shortenUrlRepository.save(url);
        return shortenUrlMapper.toResponse(url);
    }

    @Override
    public ShortenUrlResponse updateShortenUrl(String code, CreateRequest req) {
        ShortenUrl url = shortenUrlRepository.findByShortCode(code).orElseThrow(() -> new AppException(ErrorCode.URL_NOT_FOUND));
        if(!url.getUser().getId().equals(currentUser().getId())) {
            throw new AppException(ErrorCode.NOT_PERMISSION);
        }
        url.setUrl(req.getUrl());
        return shortenUrlMapper.toResponse(shortenUrlRepository.save(url));
    }

    @Override
    public Page<ShortenUrlStatResponse> getStaticUrl( Integer page, Integer size) {
        PageRequest p = PageRequest.of(page, size);
        Page<ShortenUrl> urls = shortenUrlRepository.findAllByUser(currentUser(), p);
        return urls.map(shortenUrlMapper::toStatResponse);
    }

    @Override
    public void deleteShortenUrl(String code) {
        ShortenUrl url = shortenUrlRepository.findByShortCode(code).orElseThrow(() -> new AppException(ErrorCode.URL_NOT_FOUND));
        if(!url.getUser().getId().equals(currentUser().getId())) {
            throw new AppException(ErrorCode.NOT_PERMISSION);
        }
        shortenUrlRepository.delete(url);
    }
}