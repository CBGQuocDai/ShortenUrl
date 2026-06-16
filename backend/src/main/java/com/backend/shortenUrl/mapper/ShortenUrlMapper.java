package com.backend.shortenUrl.mapper;


import com.backend.shortenUrl.dto.response.ShortenUrlResponse;
import com.backend.shortenUrl.dto.response.ShortenUrlStatResponse;
import com.backend.shortenUrl.entity.ShortenUrl;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface ShortenUrlMapper {
    ShortenUrlResponse toResponse(ShortenUrl url);
    ShortenUrlStatResponse toStatResponse(ShortenUrl url);
}
