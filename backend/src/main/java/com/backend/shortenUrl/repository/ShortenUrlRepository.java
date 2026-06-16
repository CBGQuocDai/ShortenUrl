package com.backend.shortenUrl.repository;

import com.backend.shortenUrl.entity.ShortenUrl;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ShortenUrlRepository extends JpaRepository<ShortenUrl, Long> {

    Optional<ShortenUrl> findByShortCode(String shortCode);

    boolean existsByShortCode(String shortCode);

    Page<ShortenUrl> findAllByOwnerId(Long ownerId, Pageable pageable);

    @Modifying
    @Query("update ShortenUrl s set s.accessCount = s.accessCount + 1 where s.id = :id")
    void incrementAccessCount(@Param("id") Long id);
}
