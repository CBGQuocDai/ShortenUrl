package com.backend.error;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    URL_NOT_FOUND(40401, "url isn't existed", HttpStatus.NOT_FOUND),
    URL_INVALID(40002, "url must have size between 1 and 255", HttpStatus.BAD_REQUEST),
    NOT_FOUND(40400, "resource not found", HttpStatus.NOT_FOUND),
    SHORT_CODE_INVALID(40003, "short code must have size between 1 and 255", HttpStatus.BAD_REQUEST),
    SHORT_CODE_EXISTS(40004, "short code is existed", HttpStatus.BAD_REQUEST),
    USERNAME_INVALID(40005, "username must have size between 5 and 20", HttpStatus.BAD_REQUEST),
    PASSWORD_INVALID_FORMAT(40006, "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.", HttpStatus.BAD_REQUEST),
    LOGIN_FAILED(40007, "username or password is incorrect", HttpStatus.UNAUTHORIZED),
    USERNAME_EXISTS(40008, "username is existed", HttpStatus.BAD_REQUEST),
    NOT_PERMISSION(40009, "not permission", HttpStatus.FORBIDDEN),
    ;

    private final Integer code;
    private final String message;
    private final HttpStatus status;

    ErrorCode(int i, String s, HttpStatus httpStatus) {
        this.code = i;
        this.message = s;
        this.status = httpStatus;
    }
}
