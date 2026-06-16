package com.backend.shortenUrl.repository;

import com.backend.auth.entity.User;
import com.backend.shortenUrl.entity.ShortenUrl;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShortenUrlRepository extends JpaRepository<ShortenUrl, Long> {
    Optional<ShortenUrl> findByShortCode(String shortCode);

    boolean existsByShortCode(@Size(min = 1, max = 10, message = "SHORT_CODE_INVALID") String shortCode);

    Page<ShortenUrl> findAllByUser(User currentUser, PageRequest p);
}
