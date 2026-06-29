package com.backend.auth.repository;

import com.backend.auth.entity.User;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    @Cacheable(
            value = "usersByUsername",
            key = "#username",
            unless = "#result == null"
    )
    Optional<User> findByUsername(String username);

    @Cacheable(
            value = "usersByUsernameAndEnabled",
            key = "#username + ':' + #enabled",
            unless = "#result == null"
    )
    Optional<User> findByUsernameAndEnabled(String username, boolean enabled);

    @Override
    @Caching(evict = {
            @CacheEvict(value = "usersByUsername", key = "#p0.username"),
            @CacheEvict(value = "usersByUsernameAndEnabled", key = "#p0.username + ':true'"),
            @CacheEvict(value = "usersByUsernameAndEnabled", key = "#p0.username + ':false'")
    })
    <S extends User> S save(S entity);
}