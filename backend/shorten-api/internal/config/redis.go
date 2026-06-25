package config

import (
	"log/slog"
	"os"

	"github.com/redis/go-redis/v9"
)

func ConnectRedis() *redis.Client {
	redisHost := os.Getenv("REDIS_HOST")
	if redisHost == "" {
		redisHost = "localhost:6379"
	}
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisHost,
		Password: "", // no password set
		DB:       0,  // use default DB
	})

	slog.Info("Connected to Redis")
	return rdb
}
