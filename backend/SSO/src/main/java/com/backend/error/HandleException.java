package com.backend.error;

import com.backend.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
@RequiredArgsConstructor
@Slf4j
public class HandleException {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<?> handleAppException(AppException e) {
        ApiResponse<?> resp = ApiResponse.builder()
                .code(e.getErrorCode().getCode())
                .message(e.getErrorCode().getMessage()).build();
        return ResponseEntity.status(e.getErrorCode().getStatus()).body(resp);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidationException(MethodArgumentNotValidException e) {
        ErrorCode error = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> {
                    try {
                        return ErrorCode.valueOf(fe.getDefaultMessage());
                    } catch (IllegalArgumentException ex) {
                        return ErrorCode.INVALID_INPUT;
                    }
                })
                .orElse(ErrorCode.INVALID_INPUT);
        log.error("Validation failed: {}", e.getMessage());
        ApiResponse<?> resp = ApiResponse.builder()
                .code(error.getCode())
                .message(error.getMessage()).build();
        return ResponseEntity.status(e.getStatusCode()).body(resp);
    }

    @ExceptionHandler( {NoHandlerFoundException.class, NoResourceFoundException.class})
    public ResponseEntity<?> handleNotFoundException() {
        ErrorCode err  = ErrorCode.NOT_FOUND;
        return ResponseEntity.status(err.getStatus())
                .body(
                        ApiResponse.builder().code(err.getCode())
                                .message(err.getMessage()).build()
                );
    }
}
