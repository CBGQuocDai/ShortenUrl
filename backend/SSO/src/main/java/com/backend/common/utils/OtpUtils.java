package com.backend.common.utils;


import org.springframework.stereotype.Component;

import java.util.Random;

@Component
public class OtpUtils {
    private final static Random random = new Random();

    public static String randomOtpCode() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            sb.append(random.nextInt(10));
        }
        return sb.toString();
    }
}
