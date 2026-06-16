package com.backend.shortenUrl.dto.request;


import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateRequest {
    @Size(min = 1, max = 255, message = "URL_INVALID")
    @Pattern(regexp = "^https://.*$", message = "URL_INVALID")
    private String url;

    @Size(min = 1, max = 10, message = "SHORT_CODE_INVALID")
    private String shortCode;
}
