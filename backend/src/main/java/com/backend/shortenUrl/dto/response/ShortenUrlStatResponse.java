package com.backend.shortenUrl.dto.response;

import lombok.Getter;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

@Setter
@Getter
@SuperBuilder
public class ShortenUrlStatResponse extends ShortenUrlResponse{
    private Long accessCount;
}
