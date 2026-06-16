package com.backend.shortenUrl.service;


import com.backend.common.CommonService;
import com.backend.shortenUrl.dto.request.CreateRequest;
import com.backend.shortenUrl.dto.response.ShortenUrlResponse;
import com.backend.shortenUrl.dto.response.ShortenUrlStatResponse;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;

@Service
public interface ShortenUrlService extends CommonService {
    String  retrieveOriginalUrl(String shortCode);
    ShortenUrlResponse createShortenUrl(CreateRequest req);
    ShortenUrlResponse updateShortenUrl(String code, CreateRequest req);
    Page<ShortenUrlStatResponse> getStaticUrl(Integer page, Integer size);
    void deleteShortenUrl(String code);

}
