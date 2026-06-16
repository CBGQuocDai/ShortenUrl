package com.backend.common.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class ApiResponse<T> {
    @Builder.Default
    private Integer code=1000;
    @Builder.Default
    private String message= "success";
    private T data;
}
